import { v } from 'convex/values';

import { mutation, query } from '../_generated/server';

export type ReminderEvent = {
  googleEventId: string;
  start: number;
  end: number;
  allDay: boolean;
  title: string;
  location?: string;
};

export type ReminderAttempt = {
  reminderKey: string;
};

export type DueReminderCandidate = {
  reminderKey: string;
  googleEventId: string;
  eventStart: number;
  eventEnd: number;
  leadTimeMinutes: number;
  title: string;
  location?: string;
};

export type ScheduleReminderAttemptStatus = 'sent' | 'skipped' | 'failed';

export type ScheduleReminderCycleCounts = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  outsideDeliveryWindow: boolean;
};

export type ScheduleReminderNotificationSender = (notification: {
  recipientUserId: string;
  topic: 'schedule.reminder';
  message: string;
  metadata: Record<string, string>;
}) => Promise<{ status: ScheduleReminderAttemptStatus; errorCode?: string }>;

export type ScheduleReminderAttemptRecorder = (attempt: {
  reminderKey: string;
  googleEventId: string;
  eventStart: number;
  leadTimeMinutes: number;
  attemptedAt: number;
  status: ScheduleReminderAttemptStatus;
  providerErrorCode?: string;
}) => Promise<unknown>;

type NotificationSendResult =
  | { status: 'sent'; provider?: string }
  | { status: 'skipped'; reason?: string }
  | { status: 'failed'; provider?: string; errorCode: string };

const defaultLookbackMs = 5 * 60_000;
const deliveryWindowStartHour = 6;
const deliveryWindowEndHour = 22;

function localHourMinute(nowMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(nowMs));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);

  return { hour, minute };
}

function isInsideDeliveryWindow(nowMs: number, timeZone: string) {
  const { hour } = localHourMinute(nowMs, timeZone);
  return hour >= deliveryWindowStartHour && hour < deliveryWindowEndHour;
}

function emptyCycleCounts(outsideDeliveryWindow: boolean): ScheduleReminderCycleCounts {
  return {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    outsideDeliveryWindow
  };
}

function formatReminderTime(eventStart: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit'
  })
    .format(new Date(eventStart))
    .toLowerCase();
}

export function formatScheduleReminderMessage(reminder: DueReminderCandidate, timeZone = 'Australia/Sydney') {
  const lines = [`Reminder: ${reminder.title} starts at ${formatReminderTime(reminder.eventStart, timeZone)}.`];

  if (reminder.location) {
    lines.push(`Location: ${reminder.location}`);
  }

  return lines.join('\n');
}

function aggregateDeliveryStatus(results: Array<{ status: ScheduleReminderAttemptStatus; errorCode?: string }>) {
  if (results.length === 0) {
    return { status: 'skipped' as const, errorCode: 'no_reminder_recipients' };
  }

  const failed = results.find((result) => result.status === 'failed');
  if (failed) return failed;

  const skipped = results.find((result) => result.status === 'skipped');
  if (skipped) return skipped;

  return { status: 'sent' as const };
}

export function parseRecipientUserIds(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((userId) => userId.trim())
    .filter(Boolean);
}

export function parsePositiveIntegerEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseBotGatewayOrigin() {
  const value = process.env.BOT_GATEWAY_ORIGIN;
  if (!value) throw new Error('BOT_GATEWAY_ORIGIN env var is required for schedule reminder delivery');

  const url = new URL(value);
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new Error('BOT_GATEWAY_ORIGIN must be an HTTP(S) origin');
  }

  return url.origin;
}

export function createBotGatewayNotificationSender({
  botGatewayOrigin,
  serviceToken
}: {
  botGatewayOrigin: string;
  serviceToken: string;
}): ScheduleReminderNotificationSender {
  return async (notification) => {
    let response: Response;
    try {
      response = await fetch(`${botGatewayOrigin}/notifications/send`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${serviceToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(notification)
      });
    } catch {
      return { status: 'failed', errorCode: 'bot_gateway_network_error' };
    }

    if (!response.ok) {
      return { status: 'failed', errorCode: `bot_gateway_http_${response.status}` };
    }

    let result: NotificationSendResult;
    try {
      result = (await response.json()) as NotificationSendResult;
    } catch {
      return { status: 'failed', errorCode: 'bot_gateway_invalid_response' };
    }

    if (result.status === 'sent') return { status: 'sent' };
    if (result.status === 'skipped') return { status: 'skipped', errorCode: result.reason ?? 'bot_gateway_skipped' };
    if (result.status === 'failed') return { status: 'failed', errorCode: result.errorCode };

    return { status: 'failed', errorCode: 'bot_gateway_invalid_response' };
  };
}

export function reminderKeyForEvent(event: Pick<ReminderEvent, 'googleEventId' | 'start'>, leadTimeMinutes: number) {
  return `${event.googleEventId}:${event.start}:${leadTimeMinutes}`;
}

export function getDueReminderCandidates({
  events,
  attempts,
  nowMs,
  leadTimeMinutes,
  lookbackMs = defaultLookbackMs
}: {
  events: ReminderEvent[];
  attempts: ReminderAttempt[];
  nowMs: number;
  leadTimeMinutes: number;
  lookbackMs?: number;
}): DueReminderCandidate[] {
  const attemptedKeys = new Set(attempts.map((attempt) => attempt.reminderKey));
  const leadTimeMs = leadTimeMinutes * 60_000;
  const earliestDueAt = nowMs - lookbackMs;

  return events
    .filter((event) => !event.allDay)
    .map((event) => ({
      event,
      reminderKey: reminderKeyForEvent(event, leadTimeMinutes),
      dueAt: event.start - leadTimeMs
    }))
    .filter(({ event, reminderKey, dueAt }) => {
      return event.start > nowMs && dueAt <= nowMs && dueAt >= earliestDueAt && !attemptedKeys.has(reminderKey);
    })
    .sort((a, b) => a.event.start - b.event.start)
    .map(({ event, reminderKey }) => ({
      reminderKey,
      googleEventId: event.googleEventId,
      eventStart: event.start,
      eventEnd: event.end,
      leadTimeMinutes,
      title: event.title,
      location: event.location
    }));
}

export async function runScheduleReminderCycle({
  events,
  attempts,
  nowMs,
  leadTimeMinutes,
  lookbackMs,
  timeZone,
  recipientUserIds,
  sendNotification,
  recordReminderAttempt
}: {
  events: ReminderEvent[];
  attempts: ReminderAttempt[];
  nowMs: number;
  leadTimeMinutes: number;
  lookbackMs: number;
  timeZone: string;
  recipientUserIds: string[];
  sendNotification: ScheduleReminderNotificationSender;
  recordReminderAttempt: ScheduleReminderAttemptRecorder;
}): Promise<ScheduleReminderCycleCounts> {
  if (!isInsideDeliveryWindow(nowMs, timeZone)) {
    return emptyCycleCounts(true);
  }

  const candidates = getDueReminderCandidates({
    events,
    attempts,
    nowMs,
    leadTimeMinutes,
    lookbackMs
  });
  const counts = emptyCycleCounts(false);

  for (const candidate of candidates) {
    const message = formatScheduleReminderMessage(candidate, timeZone);
    const results = await Promise.all(
      recipientUserIds.map((recipientUserId) =>
        sendNotification({
          recipientUserId,
          topic: 'schedule.reminder',
          message,
          metadata: {
            reminderKey: candidate.reminderKey,
            googleEventId: candidate.googleEventId
          }
        })
      )
    );
    const result = aggregateDeliveryStatus(results);

    await recordReminderAttempt({
      reminderKey: candidate.reminderKey,
      googleEventId: candidate.googleEventId,
      eventStart: candidate.eventStart,
      leadTimeMinutes: candidate.leadTimeMinutes,
      attemptedAt: nowMs,
      status: result.status,
      providerErrorCode: result.errorCode
    });

    counts.processed += 1;
    counts[result.status] += 1;
  }

  return counts;
}

function assertServiceToken(serviceToken: string) {
  const expectedToken = process.env.BOT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) throw new Error('Unauthorized');
}

export const dueReminderCandidates = query({
  args: {
    serviceToken: v.string(),
    nowMs: v.number(),
    leadTimeMinutes: v.number(),
    lookbackMs: v.optional(v.number())
  },
  handler: async (ctx, { serviceToken, nowMs, leadTimeMinutes, lookbackMs }) => {
    assertServiceToken(serviceToken);
    const events = await ctx.db.query('scheduleEvents').withIndex('by_start').collect();
    const attempts = await ctx.db.query('scheduleReminderAttempts').collect();

    return getDueReminderCandidates({
      events,
      attempts,
      nowMs,
      leadTimeMinutes,
      lookbackMs
    });
  }
});

export const recordReminderAttempt = mutation({
  args: {
    serviceToken: v.string(),
    reminderKey: v.string(),
    googleEventId: v.string(),
    eventStart: v.number(),
    leadTimeMinutes: v.number(),
    attemptedAt: v.number(),
    status: v.union(v.literal('sent'), v.literal('skipped'), v.literal('failed')),
    providerErrorCode: v.optional(v.string())
  },
  handler: async (ctx, { serviceToken, ...attempt }) => {
    assertServiceToken(serviceToken);
    const existing = await ctx.db
      .query('scheduleReminderAttempts')
      .withIndex('by_reminder_key', (q) => q.eq('reminderKey', attempt.reminderKey))
      .unique();

    if (existing) {
      return { inserted: false as const, id: existing._id };
    }

    const id = await ctx.db.insert('scheduleReminderAttempts', attempt);
    return { inserted: true as const, id };
  }
});
