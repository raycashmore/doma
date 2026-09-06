import type { ScheduleDisplayMember } from '../schedule/config';
import { briefingDeliveryPolicy } from './deliverySchedule';
import {
  type BriefingDeliverySlot,
  formatBriefingDeliveryMessage,
  isPlainBriefingText,
  isValidMorningBriefingForMembers,
  type MorningBriefing,
  morningBriefingKey
} from './morning';

export type BotMorningBriefing = {
  briefingKey: string;
  localDate: string;
  generationStatus: 'ai' | 'deterministic' | 'fallback' | 'setupProblem';
  shouldSend: boolean;
  message: string;
  briefing?: MorningBriefing;
};

export type BriefingDeliveryAttemptStatus = 'pending' | BriefingDeliveryStatus;
export type BriefingDeliveryStatus = 'sent' | 'skipped' | 'failed';

export type BriefingDeliveryAttempt = {
  briefingKey: string;
  recipientUserId: string;
  status?: BriefingDeliveryAttemptStatus;
};

export type MorningBriefingDeliveryCounts = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  outsideDeliveryWindow: boolean;
  syncFailed: boolean;
  staleCache: boolean;
  generated: boolean;
};

export type MorningBriefingNotificationSender = (notification: {
  recipientUserId: string;
  topic: 'briefing.morning';
  message: string;
  metadata: Record<string, string>;
}) => Promise<{ status: BriefingDeliveryStatus; errorCode?: string }>;

export type MorningBriefingDeliveryAttemptRecorder = (attempt: {
  briefingKey: string;
  recipientUserId: string;
  attemptedAt: number;
  status: BriefingDeliveryAttemptStatus;
  providerErrorCode?: string;
}) => Promise<{ claimed?: boolean } | unknown>;

const staleScheduleDataMs = 12 * 60 * 60_000;

function localParts(nowMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(nowMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const weekday = part('weekday');
  const hour = Number(part('hour'));
  const minute = Number(part('minute'));

  if (!year || !month || !day || !weekday || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error('Could not resolve local morning briefing time');
  }

  return {
    localDate: `${year}-${month}-${day}`,
    isWeekend: weekday === 'Sat' || weekday === 'Sun',
    minuteOfDay: hour * 60 + minute
  };
}

export function deliverySlotForTime(nowMs: number, timeZone: string): BriefingDeliverySlot | null {
  const { isWeekend, minuteOfDay } = localParts(nowMs, timeZone);
  const morningStartTime = briefingDeliveryPolicy.morning.retryTimes[0];
  const afternoonStartTime = briefingDeliveryPolicy.afternoon.retryTimes[0];
  const morningStart = morningStartTime.hour * 60 + morningStartTime.minute;
  const morningEnd =
    briefingDeliveryPolicy.morning.windowEnd.hour * 60 + briefingDeliveryPolicy.morning.windowEnd.minute;
  const afternoonStart = afternoonStartTime.hour * 60 + afternoonStartTime.minute;
  const afternoonEnd =
    briefingDeliveryPolicy.afternoon.windowEnd.hour * 60 + briefingDeliveryPolicy.afternoon.windowEnd.minute;

  if (minuteOfDay >= morningStart && minuteOfDay < morningEnd) return 'morning';
  if (isWeekend) return null;
  if (minuteOfDay >= afternoonStart && minuteOfDay < afternoonEnd) return 'afternoon';
  return null;
}

function deliveryKey(briefingKey: string, slot: BriefingDeliverySlot) {
  return `${briefingKey}:${slot}`;
}

function emptyCounts(overrides: Partial<MorningBriefingDeliveryCounts> = {}): MorningBriefingDeliveryCounts {
  return {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    outsideDeliveryWindow: false,
    syncFailed: false,
    staleCache: false,
    generated: false,
    ...overrides
  };
}

function completedRecipientIds(attempts: BriefingDeliveryAttempt[], briefingKey: string, legacyBriefingKey?: string) {
  const completedKeys = new Set([briefingKey, ...(legacyBriefingKey ? [legacyBriefingKey] : [])]);
  return new Set(
    attempts
      .filter(
        (attempt) =>
          completedKeys.has(attempt.briefingKey) && (attempt.status === 'sent' || attempt.status === 'skipped')
      )
      .map((attempt) => attempt.recipientUserId)
  );
}

function withStaleScheduleNote(message: string) {
  return `${message}\nNote: schedule data may be stale because the latest calendar sync failed.`;
}

function isDeliverableBriefing(briefing: BotMorningBriefing, members: ScheduleDisplayMember[]) {
  return briefing.briefing
    ? isValidMorningBriefingForMembers(briefing.briefing, members)
    : isPlainBriefingText(briefing.message);
}

function hasNoteworthyContentForSlot(briefing: BotMorningBriefing, slot: BriefingDeliverySlot) {
  if (!briefing.briefing) return false;
  if (slot === 'morning') return briefing.briefing.watchouts.length > 0;
  return briefing.briefing.watchouts.some((watchout) => watchout.afternoonEligible === true);
}

export async function runMorningBriefingDeliveryCycle({
  nowMs,
  timeZone,
  members,
  recipientUserIds,
  attempts,
  lastSyncedAt,
  syncSchedule,
  loadBriefing,
  generateBriefing,
  sendNotification,
  recordDeliveryAttempt
}: {
  nowMs: number;
  timeZone: string;
  members: ScheduleDisplayMember[];
  recipientUserIds: string[];
  attempts: BriefingDeliveryAttempt[];
  lastSyncedAt: number | null;
  syncSchedule: () => Promise<{ ok: true; lastSyncedAt: number } | { ok: false; lastSyncedAt: number | null }>;
  loadBriefing: (input: { localDate: string }) => Promise<BotMorningBriefing | null>;
  generateBriefing: (input: {
    localDate: string;
    timeZone: string;
    generatedAt: number;
    replaceExisting?: boolean;
  }) => Promise<BotMorningBriefing>;
  sendNotification: MorningBriefingNotificationSender;
  recordDeliveryAttempt: MorningBriefingDeliveryAttemptRecorder;
}): Promise<MorningBriefingDeliveryCounts> {
  const deliverySlot = deliverySlotForTime(nowMs, timeZone);
  if (!deliverySlot) {
    return emptyCounts({ outsideDeliveryWindow: true });
  }

  if (recipientUserIds.length === 0) {
    return emptyCounts();
  }

  const { localDate } = localParts(nowMs, timeZone);
  const baseBriefingKey = morningBriefingKey({ briefingKind: 'morning', localDate });
  const key = deliveryKey(baseBriefingKey, deliverySlot);
  const completedRecipients = completedRecipientIds(
    attempts,
    key,
    deliverySlot === 'morning' ? baseBriefingKey : undefined
  );
  const pendingRecipientUserIds = recipientUserIds.filter(
    (recipientUserId) => !completedRecipients.has(recipientUserId)
  );

  if (pendingRecipientUserIds.length === 0) {
    return emptyCounts();
  }

  const syncResult = await syncSchedule();
  const syncFailed = !syncResult.ok;
  const effectiveLastSyncedAt = syncResult.lastSyncedAt ?? lastSyncedAt;
  const staleCache = syncFailed && (!effectiveLastSyncedAt || nowMs - effectiveLastSyncedAt > staleScheduleDataMs);
  const existingBriefing = await loadBriefing({ localDate });
  const refreshExistingBriefing = deliverySlot === 'afternoon' && !syncFailed;
  const generated = !existingBriefing || refreshExistingBriefing;
  const briefing =
    !refreshExistingBriefing && existingBriefing
      ? existingBriefing
      : await generateBriefing({
          localDate,
          timeZone,
          generatedAt: nowMs,
          ...(refreshExistingBriefing ? { replaceExisting: true } : {})
        });
  if (!isDeliverableBriefing(briefing, members)) {
    throw new Error('Morning briefing is not valid stored briefing content');
  }
  const counts = emptyCounts({ syncFailed, staleCache, generated });
  const baseMessage = briefing.briefing
    ? formatBriefingDeliveryMessage(briefing.briefing, members, { slot: deliverySlot })
    : briefing.message;
  const shouldSend =
    briefing.shouldSend && hasNoteworthyContentForSlot(briefing, deliverySlot) && baseMessage.trim().length > 0;
  const message = shouldSend && staleCache ? withStaleScheduleNote(baseMessage) : baseMessage;

  for (const recipientUserId of pendingRecipientUserIds) {
    const claimResult = await recordDeliveryAttempt({
      briefingKey: key,
      recipientUserId,
      attemptedAt: nowMs,
      status: 'pending'
    });

    if (typeof claimResult === 'object' && claimResult !== null && 'claimed' in claimResult && !claimResult.claimed) {
      continue;
    }

    if (!shouldSend) {
      await recordDeliveryAttempt({
        briefingKey: key,
        recipientUserId,
        attemptedAt: nowMs,
        status: 'skipped'
      });

      counts.processed += 1;
      counts.skipped += 1;
      continue;
    }

    const result = await sendNotification({
      recipientUserId,
      topic: 'briefing.morning',
      message,
      metadata: {
        briefingKey: briefing.briefingKey,
        deliveryKey: key,
        deliverySlot,
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });

    await recordDeliveryAttempt({
      briefingKey: key,
      recipientUserId,
      attemptedAt: nowMs,
      status: result.status,
      ...(result.errorCode ? { providerErrorCode: result.errorCode } : {})
    });

    counts.processed += 1;
    counts[result.status] += 1;
  }

  return counts;
}
