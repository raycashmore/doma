export type BotMorningBriefing = {
  briefingKey: string;
  localDate: string;
  generationStatus: 'ai' | 'deterministic' | 'fallback' | 'setupProblem';
  shouldSend: boolean;
  message: string;
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

const retryWindowStart = { hour: 7, minute: 30 };
const retryWindowEnd = { hour: 8, minute: 30 };
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

function isInsideMorningRetryWindow(nowMs: number, timeZone: string) {
  const { minuteOfDay } = localParts(nowMs, timeZone);
  const start = retryWindowStart.hour * 60 + retryWindowStart.minute;
  const end = retryWindowEnd.hour * 60 + retryWindowEnd.minute;

  return minuteOfDay >= start && minuteOfDay < end;
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

function completedRecipientIds(attempts: BriefingDeliveryAttempt[], briefingKey: string) {
  return new Set(
    attempts
      .filter(
        (attempt) => attempt.briefingKey === briefingKey && (attempt.status === 'sent' || attempt.status === 'skipped')
      )
      .map((attempt) => attempt.recipientUserId)
  );
}

function withStaleScheduleNote(message: string) {
  return `${message}\nNote: schedule data may be stale because the latest calendar sync failed.`;
}

export async function runMorningBriefingDeliveryCycle({
  nowMs,
  timeZone,
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
  sendNotification: MorningBriefingNotificationSender;
  recordDeliveryAttempt: MorningBriefingDeliveryAttemptRecorder;
}): Promise<MorningBriefingDeliveryCounts> {
  if (!isInsideMorningRetryWindow(nowMs, timeZone)) {
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
  const counts = emptyCounts({ syncFailed, staleCache, generated });
  const completedRecipients = completedRecipientIds(attempts, briefing.briefingKey);
  const pendingRecipientUserIds = recipientUserIds.filter(
    (recipientUserId) => !completedRecipients.has(recipientUserId)
  );
  const message = staleCache ? withStaleScheduleNote(briefing.message) : briefing.message;
  const shouldSend = briefing.shouldSend && message.trim().length > 0;

  for (const recipientUserId of pendingRecipientUserIds) {
    const claimResult = await recordDeliveryAttempt({
      briefingKey: briefing.briefingKey,
      recipientUserId,
      attemptedAt: nowMs,
      status: 'pending'
    });

    if (typeof claimResult === 'object' && claimResult !== null && 'claimed' in claimResult && !claimResult.claimed) {
      continue;
    }

    if (!shouldSend) {
      await recordDeliveryAttempt({
        briefingKey: briefing.briefingKey,
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
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });

    await recordDeliveryAttempt({
      briefingKey: briefing.briefingKey,
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
