import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { internalMutation } from '../_generated/server';
import { upcomingBriefingDeliverySlots } from './deliverySchedule';

const scheduleHorizonMs = 48 * 60 * 60_000;

type ScheduledDeliveryRef = FunctionReference<
  'action',
  'internal',
  { scheduleSlotKey: string; localDate: string; slot: 'morning' | 'afternoon'; scheduledAt: number },
  unknown
>;

const scheduledDelivery = (
  internal as unknown as {
    briefing: { deliveryRunner: { runScheduledMorningBriefingDelivery: ScheduledDeliveryRef } };
  }
).briefing.deliveryRunner.runScheduledMorningBriefingDelivery;

function briefingTimeZone() {
  return process.env.MORNING_BRIEFING_TZ ?? process.env.SCHEDULE_TZ ?? 'Australia/Sydney';
}

export const reconcileMorningBriefingDeliverySchedule = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    const slots = upcomingBriefingDeliverySlots({ nowMs, timeZone: briefingTimeZone(), horizonMs: scheduleHorizonMs });
    let scheduled = 0;

    for (const slot of slots) {
      const existing = await ctx.db
        .query('briefingDeliveryScheduleSlots')
        .withIndex('by_key', (q) => q.eq('key', slot.key))
        .unique();
      if (existing) continue;

      await ctx.scheduler.runAt(slot.scheduledAt, scheduledDelivery, {
        scheduleSlotKey: slot.key,
        localDate: slot.localDate,
        slot: slot.slot,
        scheduledAt: slot.scheduledAt
      });
      await ctx.db.insert('briefingDeliveryScheduleSlots', { ...slot, status: 'scheduled' });
      scheduled += 1;
    }

    return { scheduled, existing: slots.length - scheduled };
  }
});

export const completeBriefingDeliveryScheduleSlot = internalMutation({
  args: {
    key: v.string(),
    completedAt: v.number(),
    outcome: v.union(v.literal('completed'), v.literal('failed'))
  },
  handler: async (ctx, { key, completedAt, outcome }) => {
    const row = await ctx.db
      .query('briefingDeliveryScheduleSlots')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();
    if (!row) throw new Error(`Unknown briefing delivery schedule slot: ${key}`);
    await ctx.db.patch(row._id, { status: outcome, completedAt });
  }
});
