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
  recipientUserId?: string;
  status?: ScheduleReminderAttemptStatus;
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

export type ScheduleReminderAttemptStatus = 'pending' | ScheduleReminderDeliveryStatus;
export type ScheduleReminderDeliveryStatus = 'sent' | 'skipped' | 'failed';

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
}) => Promise<{ status: ScheduleReminderDeliveryStatus; errorCode?: string }>;

export type ScheduleReminderAttemptRecorder = (attempt: {
  reminderKey: string;
  recipientUserId?: string;
  googleEventId: string;
  eventStart: number;
  leadTimeMinutes: number;
  attemptedAt: number;
  status: ScheduleReminderAttemptStatus;
  providerErrorCode?: string;
}) => Promise<{ claimed?: boolean } | unknown>;

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

function sentRecipientIdsForReminder(attempts: ReminderAttempt[], reminderKey: string) {
  return new Set(
    attempts
      .filter((attempt) => attempt.reminderKey === reminderKey)
      .filter((attempt) => attempt.status === 'sent')
      .map((attempt) => attempt.recipientUserId)
      .filter((recipientUserId): recipientUserId is string => Boolean(recipientUserId))
  );
}

function hasLegacyEventLevelAttempt(attempts: ReminderAttempt[], reminderKey: string) {
  return attempts.some((attempt) => attempt.reminderKey === reminderKey && !attempt.recipientUserId);
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
  const attemptedKeys = new Set(
    attempts.filter((attempt) => !attempt.recipientUserId).map((attempt) => attempt.reminderKey)
  );
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
    const sentRecipientIds = sentRecipientIdsForReminder(attempts, candidate.reminderKey);
    const pendingRecipientUserIds = recipientUserIds.filter(
      (recipientUserId) => !sentRecipientIds.has(recipientUserId)
    );

    if (hasLegacyEventLevelAttempt(attempts, candidate.reminderKey)) {
      continue;
    }

    if (recipientUserIds.length === 0) {
      await recordReminderAttempt({
        reminderKey: candidate.reminderKey,
        googleEventId: candidate.googleEventId,
        eventStart: candidate.eventStart,
        leadTimeMinutes: candidate.leadTimeMinutes,
        attemptedAt: nowMs,
        status: 'skipped',
        providerErrorCode: 'no_reminder_recipients'
      });

      counts.processed += 1;
      counts.skipped += 1;
      continue;
    }

    if (pendingRecipientUserIds.length === 0) {
      continue;
    }

    const results = await Promise.all(
      pendingRecipientUserIds.map(async (recipientUserId) => {
        const claimResult = await recordReminderAttempt({
          reminderKey: candidate.reminderKey,
          recipientUserId,
          googleEventId: candidate.googleEventId,
          eventStart: candidate.eventStart,
          leadTimeMinutes: candidate.leadTimeMinutes,
          attemptedAt: nowMs,
          status: 'pending'
        });

        if (
          typeof claimResult === 'object' &&
          claimResult !== null &&
          'claimed' in claimResult &&
          !claimResult.claimed
        ) {
          return null;
        }

        const result = await sendNotification({
          recipientUserId,
          topic: 'schedule.reminder',
          message,
          metadata: {
            reminderKey: candidate.reminderKey,
            googleEventId: candidate.googleEventId
          }
        });

        await recordReminderAttempt({
          reminderKey: candidate.reminderKey,
          recipientUserId,
          googleEventId: candidate.googleEventId,
          eventStart: candidate.eventStart,
          leadTimeMinutes: candidate.leadTimeMinutes,
          attemptedAt: nowMs,
          status: result.status,
          ...(result.errorCode ? { providerErrorCode: result.errorCode } : {})
        });

        return result;
      })
    );

    for (const result of results) {
      if (!result) {
        continue;
      }

      counts.processed += 1;
      counts[result.status] += 1;
    }
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
    const leadTimeMs = leadTimeMinutes * 60_000;
    const reminderLookbackMs = lookbackMs ?? defaultLookbackMs;
    const earliestDueAt = nowMs - reminderLookbackMs;
    const events = (
      await ctx.db
        .query('scheduleEvents')
        .withIndex('by_start', (q) => q.gt('start', nowMs).lte('start', nowMs + leadTimeMs))
        .collect()
    ).filter((event) => !event.allDay && event.start - leadTimeMs >= earliestDueAt);
    const attempts = (
      await Promise.all(
        events.map((event) =>
          ctx.db
            .query('scheduleReminderAttempts')
            .withIndex('by_reminder_key', (q) => q.eq('reminderKey', reminderKeyForEvent(event, leadTimeMinutes)))
            .collect()
        )
      )
    ).flat();

    return getDueReminderCandidates({
      events,
      attempts,
      nowMs,
      leadTimeMinutes,
      lookbackMs: reminderLookbackMs
    });
  }
});

export const recordReminderAttempt = mutation({
  args: {
    serviceToken: v.string(),
    reminderKey: v.string(),
    recipientUserId: v.optional(v.string()),
    googleEventId: v.string(),
    eventStart: v.number(),
    leadTimeMinutes: v.number(),
    attemptedAt: v.number(),
    status: v.union(v.literal('pending'), v.literal('sent'), v.literal('skipped'), v.literal('failed')),
    providerErrorCode: v.optional(v.string())
  },
  handler: async (ctx, { serviceToken, ...attempt }) => {
    assertServiceToken(serviceToken);
    const existingAttempts = attempt.recipientUserId
      ? await ctx.db
          .query('scheduleReminderAttempts')
          .withIndex('by_reminder_recipient', (q) =>
            q.eq('reminderKey', attempt.reminderKey).eq('recipientUserId', attempt.recipientUserId)
          )
          .collect()
      : await ctx.db
          .query('scheduleReminderAttempts')
          .withIndex('by_reminder_key', (q) => q.eq('reminderKey', attempt.reminderKey))
          .collect();
    const sentAttempt = existingAttempts.find((existingAttempt) => existingAttempt.status === 'sent');
    const pendingAttempt = existingAttempts.find((existingAttempt) => existingAttempt.status === 'pending');

    if (attempt.status === 'pending') {
      const claimedAttempt = sentAttempt ?? pendingAttempt;

      if (claimedAttempt) {
        return { claimed: false as const, inserted: false as const, id: claimedAttempt._id };
      }

      const retryableAttempt = existingAttempts[0];
      if (retryableAttempt) {
        await ctx.db.patch(retryableAttempt._id, attempt);
        return { claimed: true as const, inserted: false as const, id: retryableAttempt._id };
      }

      const id = await ctx.db.insert('scheduleReminderAttempts', attempt);
      return { claimed: true as const, inserted: true as const, id };
    }

    if (sentAttempt) {
      return { claimed: false as const, inserted: false as const, id: sentAttempt._id };
    }

    if (pendingAttempt) {
      await ctx.db.patch(pendingAttempt._id, attempt);
      return { claimed: true as const, inserted: false as const, id: pendingAttempt._id };
    }

    const retryableAttempt = existingAttempts[0];
    if (retryableAttempt) {
      await ctx.db.patch(retryableAttempt._id, attempt);
      return { claimed: true as const, inserted: false as const, id: retryableAttempt._id };
    }

    const id = await ctx.db.insert('scheduleReminderAttempts', attempt);
    return { claimed: true as const, inserted: true as const, id };
  }
});
