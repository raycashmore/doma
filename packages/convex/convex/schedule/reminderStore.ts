import { v } from 'convex/values';

import { internalMutation, internalQuery } from '../_generated/server';
import { reminderKeyForEvent } from './reminders';

export const reminderRunInputs = internalQuery({
  args: {
    nowMs: v.number(),
    leadTimeMinutes: v.number(),
    lookbackMs: v.number()
  },
  handler: async (ctx, { nowMs, leadTimeMinutes, lookbackMs }) => {
    const leadTimeMs = leadTimeMinutes * 60_000;
    const earliestDueAt = nowMs - lookbackMs;
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

    return { events, attempts };
  }
});

export const recordReminderAttempt = internalMutation({
  args: {
    reminderKey: v.string(),
    recipientUserId: v.optional(v.string()),
    googleEventId: v.string(),
    eventStart: v.number(),
    leadTimeMinutes: v.number(),
    attemptedAt: v.number(),
    status: v.union(v.literal('sent'), v.literal('skipped'), v.literal('failed')),
    providerErrorCode: v.optional(v.string())
  },
  handler: async (ctx, attempt) => {
    const existing = attempt.recipientUserId
      ? await ctx.db
          .query('scheduleReminderAttempts')
          .withIndex('by_reminder_recipient', (q) =>
            q.eq('reminderKey', attempt.reminderKey).eq('recipientUserId', attempt.recipientUserId)
          )
          .unique()
      : await ctx.db
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
