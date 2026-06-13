import { v } from 'convex/values';

import { internalMutation, internalQuery } from '../_generated/server';
import { morningBriefingKey } from './morning';

export const briefingDeliveryRunInputs = internalQuery({
  args: {
    localDate: v.string()
  },
  handler: async (ctx, { localDate }) => {
    const briefingKey = morningBriefingKey({ briefingKind: 'morning', localDate });
    const [briefing, attempts, syncMeta] = await Promise.all([
      ctx.db
        .query('briefings')
        .withIndex('by_briefing_key', (q) => q.eq('briefingKey', briefingKey))
        .unique(),
      ctx.db
        .query('briefingDeliveryAttempts')
        .withIndex('by_briefing_key', (q) => q.eq('briefingKey', briefingKey))
        .collect(),
      ctx.db
        .query('scheduleSyncMeta')
        .withIndex('by_key', (q) => q.eq('key', 'default'))
        .unique()
    ]);

    return {
      briefing: briefing
        ? {
            briefingKey: briefing.briefingKey,
            localDate: briefing.localDate,
            generationStatus: briefing.generationStatus,
            shouldSend: briefing.briefing.shouldSend,
            message: briefing.message
          }
        : null,
      attempts,
      lastSyncedAt: syncMeta?.lastSyncedAt ?? null
    };
  }
});

export const recordBriefingDeliveryAttempt = internalMutation({
  args: {
    briefingKey: v.string(),
    recipientUserId: v.string(),
    attemptedAt: v.number(),
    status: v.union(v.literal('pending'), v.literal('sent'), v.literal('skipped'), v.literal('failed')),
    providerErrorCode: v.optional(v.string())
  },
  handler: async (ctx, attempt) => {
    const existingAttempts = await ctx.db
      .query('briefingDeliveryAttempts')
      .withIndex('by_briefing_recipient', (q) =>
        q.eq('briefingKey', attempt.briefingKey).eq('recipientUserId', attempt.recipientUserId)
      )
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

      const id = await ctx.db.insert('briefingDeliveryAttempts', attempt);
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

    const id = await ctx.db.insert('briefingDeliveryAttempts', attempt);
    return { claimed: true as const, inserted: true as const, id };
  }
});
