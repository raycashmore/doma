import type { ScheduleDisplayMember } from '../schedule/config';
import {
  type BriefingDeliverySlot,
  formatBriefingDeliveryMessage,
  isPlainBriefingText,
  isValidMorningBriefingForMembers,
  type MorningBriefing
} from './morning';
import type { MorningBriefingWeatherContext } from './weather';

export type BotMorningBriefing = {
  briefingKey: string;
  localDate: string;
  generationStatus: 'ai' | 'deterministic' | 'fallback' | 'setupProblem';
  shouldSend: boolean;
  message: string;
  parseMode?: 'HTML';
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
  parseMode?: 'HTML';
  metadata: Record<string, string>;
}) => Promise<{ status: BriefingDeliveryStatus; errorCode?: string }>;

export type MorningBriefingDeliveryAttemptRecorder = (attempt: {
  briefingKey: string;
  recipientUserId: string;
  attemptedAt: number;
  status: BriefingDeliveryAttemptStatus;
  providerErrorCode?: string;
}) => Promise<{ claimed?: boolean } | unknown>;

const retryWindowStart = { hour: 7, minute: 35 };
const retryWindowEnd = { hour: 8, minute: 30 };
const afternoonRetryWindowStart = { hour: 14, minute: 30 };
const afternoonRetryWindowEnd = { hour: 15, minute: 0 };
const staleScheduleDataMs = 12 * 60 * 60_000;

function localParts(nowMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(nowMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const hour = Number(part('hour'));
  const minute = Number(part('minute'));

  if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error('Could not resolve local morning briefing time');
  }

  return {
    localDate: `${year}-${month}-${day}`,
    minuteOfDay: hour * 60 + minute
  };
}

function deliverySlotForTime(nowMs: number, timeZone: string): BriefingDeliverySlot | null {
  const { minuteOfDay } = localParts(nowMs, timeZone);
  const morningStart = retryWindowStart.hour * 60 + retryWindowStart.minute;
  const morningEnd = retryWindowEnd.hour * 60 + retryWindowEnd.minute;
  const afternoonStart = afternoonRetryWindowStart.hour * 60 + afternoonRetryWindowStart.minute;
  const afternoonEnd = afternoonRetryWindowEnd.hour * 60 + afternoonRetryWindowEnd.minute;

  if (minuteOfDay >= morningStart && minuteOfDay < morningEnd) return 'morning';
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

const boldTelegramKeywordPattern = /\b(swimming|dancing|library|homework|sport)\b/gi;

function escapeTelegramHtml(message: string) {
  return message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatBriefingTelegramHtml(message: string) {
  return escapeTelegramHtml(message).replace(boldTelegramKeywordPattern, '<b>$1</b>');
}

function deliveryMessage({
  briefing,
  members,
  slot,
  weather
}: {
  briefing: BotMorningBriefing;
  members: ScheduleDisplayMember[];
  slot: BriefingDeliverySlot;
  weather?: MorningBriefingWeatherContext;
}) {
  const message = briefing.briefing
    ? formatBriefingDeliveryMessage(briefing.briefing, members, { slot, weather })
    : briefing.message;

  return message;
}

function isDeliverableBriefing(briefing: BotMorningBriefing, members: ScheduleDisplayMember[]) {
  return briefing.briefing
    ? isValidMorningBriefingForMembers(briefing.briefing, members)
    : isPlainBriefingText(briefing.message);
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
  loadWeather,
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
  }) => Promise<BotMorningBriefing>;
  loadWeather?: (input: { localDate: string; timeZone: string }) => Promise<MorningBriefingWeatherContext | undefined>;
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
  const syncResult = await syncSchedule();
  const syncFailed = !syncResult.ok;
  const effectiveLastSyncedAt = syncResult.lastSyncedAt ?? lastSyncedAt;
  const staleCache = syncFailed && (!effectiveLastSyncedAt || nowMs - effectiveLastSyncedAt > staleScheduleDataMs);
  const existingBriefing = await loadBriefing({ localDate });
  const generated = !existingBriefing;
  const briefing =
    existingBriefing ??
    (await generateBriefing({
      localDate,
      timeZone,
      generatedAt: nowMs
    }));
  if (!isDeliverableBriefing(briefing, members)) {
    throw new Error('Morning briefing is not valid stored briefing content');
  }
  const counts = emptyCounts({ syncFailed, staleCache, generated });
  const key = deliveryKey(briefing.briefingKey, deliverySlot);
  const completedRecipients = completedRecipientIds(
    attempts,
    key,
    deliverySlot === 'morning' ? briefing.briefingKey : undefined
  );
  const pendingRecipientUserIds = recipientUserIds.filter(
    (recipientUserId) => !completedRecipients.has(recipientUserId)
  );
  const weather = deliverySlot === 'afternoon' && loadWeather ? await loadWeather({ localDate, timeZone }) : undefined;
  const baseMessage = deliveryMessage({ briefing, members, slot: deliverySlot, weather });
  const message = staleCache ? withStaleScheduleNote(baseMessage) : baseMessage;
  const shouldSend = briefing.shouldSend && message.trim().length > 0;

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
      message: formatBriefingTelegramHtml(message),
      parseMode: 'HTML',
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
