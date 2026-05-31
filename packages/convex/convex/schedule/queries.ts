import { v } from 'convex/values';
import { internalMutation, query } from '../_generated/server';

const eventValidator = v.object({
  googleEventId: v.string(),
  calendarId: v.string(),
  start: v.number(),
  end: v.number(),
  allDay: v.boolean(),
  title: v.string(),
  location: v.optional(v.string()),
  who: v.array(v.string()),
  recurring: v.boolean(),
  htmlLink: v.string()
});

// Full-replace the table with the freshly-synced week. Internal: only the
// sync action calls this.
export const replaceAll = internalMutation({
  args: { events: v.array(eventValidator) },
  handler: async (ctx, { events }) => {
    const existing = await ctx.db.query('scheduleEvents').collect();
    for (const row of existing) await ctx.db.delete(row._id);
    for (const event of events) await ctx.db.insert('scheduleEvents', event);
  }
});

// Read-only current-week feed for the swimlanes UI. Clerk-gated.
export const currentWeek = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    return await ctx.db.query('scheduleEvents').withIndex('by_start').collect();
  }
});
