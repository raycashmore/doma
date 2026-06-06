import { v } from 'convex/values';

import { internalMutation, internalQuery } from '../_generated/server';

export const reminderRunInputs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query('scheduleEvents').withIndex('by_start').collect();
    const attempts = await ctx.db.query('scheduleReminderAttempts').collect();

    return { events, attempts };
  }
});

export const recordReminderAttempt = internalMutation({
  args: {
    reminderKey: v.string(),
    googleEventId: v.string(),
    eventStart: v.number(),
    leadTimeMinutes: v.number(),
    attemptedAt: v.number(),
    status: v.union(v.literal('sent'), v.literal('skipped'), v.literal('failed')),
    providerErrorCode: v.optional(v.string())
  },
  handler: async (ctx, attempt) => {
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
