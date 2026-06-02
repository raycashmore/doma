import { v } from 'convex/values';

import { internalMutation, internalQuery, query, type QueryCtx } from '../_generated/server';

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

async function readLastSyncedAt(ctx: QueryCtx): Promise<number | null> {
  const meta = await ctx.db
    .query('scheduleSyncMeta')
    .withIndex('by_key', (q) => q.eq('key', 'default'))
    .unique();
  return meta?.lastSyncedAt ?? null;
}

// Full-replace the table with the freshly-synced week and stamp the sync time.
// Internal: only the sync action calls this.
export const replaceAll = internalMutation({
  args: { events: v.array(eventValidator), syncedAt: v.number() },
  handler: async (ctx, { events, syncedAt }) => {
    const existing = await ctx.db.query('scheduleEvents').collect();
    for (const row of existing) await ctx.db.delete(row._id);
    for (const event of events) await ctx.db.insert('scheduleEvents', event);

    const meta = await ctx.db
      .query('scheduleSyncMeta')
      .withIndex('by_key', (q) => q.eq('key', 'default'))
      .unique();
    if (meta) await ctx.db.patch(meta._id, { lastSyncedAt: syncedAt });
    else await ctx.db.insert('scheduleSyncMeta', { key: 'default', lastSyncedAt: syncedAt });
  }
});

// Last successful sync time (epoch ms) or null. Internal: the refresh action
// reads this to decide whether a fresh re-sync is needed.
export const syncMeta = internalQuery({
  args: {},
  handler: async (ctx) => readLastSyncedAt(ctx)
});

// Read-only current-week feed for the swimlanes UI, plus the last sync time for
// the "Synced X ago" banner.
//
// NOTE: this query gates on Clerk identity, which is intentionally ahead of the
// rest of this deployment — the budget queries currently rely solely on the
// app-level AuthGate and do not check identity server-side. Family whereabouts
// are sensitive enough to warrant the explicit gate here. It is only ever
// called from the authenticated schedule app (never seeds/admin scripts/SSR).
// If/when the other queries adopt server-side gating, fold this into a shared
// helper.
export const currentWeek = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    const events = await ctx.db.query('scheduleEvents').withIndex('by_start').collect();
    return { events, lastSyncedAt: await readLastSyncedAt(ctx) };
  }
});
