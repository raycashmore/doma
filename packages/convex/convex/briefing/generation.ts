import { v } from 'convex/values';

import { internalMutation, internalQuery } from '../_generated/server';
import { parseScheduleCalendars } from '../schedule/config';
import { createDeterministicMorningBriefing, morningBriefingKey } from './morning';

export const generateAndStoreDeterministicMorningBriefing = internalMutation({
  args: {
    localDate: v.string(),
    timeZone: v.optional(v.string()),
    generatedAt: v.number()
  },
  handler: async (ctx, { localDate, timeZone, generatedAt }) => {
    const briefing = createDeterministicMorningBriefing({
      localDate,
      timeZone: timeZone ?? process.env.SCHEDULE_TZ ?? 'Australia/Sydney',
      calendarConfigs: parseScheduleCalendars(),
      events: await ctx.db.query('scheduleEvents').withIndex('by_start').collect()
    });
    const briefingKey = morningBriefingKey({
      briefingKind: briefing.briefingKind,
      localDate: briefing.localDate
    });
    const existing = await ctx.db
      .query('briefings')
      .withIndex('by_briefing_key', (q) => q.eq('briefingKey', briefingKey))
      .unique();
    const row = {
      briefingKey,
      briefingKind: briefing.briefingKind,
      localDate: briefing.localDate,
      generationStatus: briefing.generationStatus,
      generatedAt,
      message: briefing.message,
      briefing: briefing.briefing,
      sourceIds: briefing.sourceIds
    };

    if (existing) return { inserted: false as const, id: existing._id, briefing: existing };

    const id = await ctx.db.insert('briefings', row);
    return { inserted: true as const, id, briefing: row };
  }
});

export const briefingForLocalDate = internalQuery({
  args: {
    briefingKind: v.literal('morning'),
    localDate: v.string()
  },
  handler: async (ctx, { briefingKind, localDate }) => {
    return await ctx.db
      .query('briefings')
      .withIndex('by_briefing_key', (q) => q.eq('briefingKey', morningBriefingKey({ briefingKind, localDate })))
      .unique();
  }
});
