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

const defaultLookbackMs = 5 * 60_000;

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
