import { v } from 'convex/values';

import { internalMutation, internalQuery } from '../_generated/server';

export const emailNoticeDeliveryRunInputs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const notices = await ctx.db
      .query('emailNotices')
      .withIndex('by_telegram_worthy', (q) => q.eq('telegramWorthy', true))
      .collect();
    const activeNotices = notices
      .filter((notice) => notice.archivedAt === undefined)
      .sort((left, right) => left.createdAt - right.createdAt);
    const attempts = (
      await Promise.all(
        activeNotices.map((notice) =>
          ctx.db
            .query('emailNoticeDeliveryAttempts')
            .withIndex('by_notice_id', (q) => q.eq('noticeId', notice._id))
            .collect()
        )
      )
    ).flat();

    return {
      notices: activeNotices.map((notice) => ({
        id: notice._id,
        capturedEmailId: notice.capturedEmailId,
        category: notice.category,
        priority: notice.priority,
        title: notice.title,
        body: notice.body,
        extractedFacts: notice.extractedFacts,
        telegramWorthy: notice.telegramWorthy,
        createdAt: notice.createdAt
      })),
      attempts
    };
  }
});

export const recordEmailNoticeDeliveryAttempt = internalMutation({
  args: {
    noticeId: v.id('emailNotices'),
    recipientUserId: v.string(),
    attemptedAt: v.number(),
    status: v.union(v.literal('pending'), v.literal('sent'), v.literal('skipped'), v.literal('failed')),
    providerErrorCode: v.optional(v.string())
  },
  handler: async (ctx, attempt) => {
    const existingAttempts = await ctx.db
      .query('emailNoticeDeliveryAttempts')
      .withIndex('by_notice_recipient', (q) =>
        q.eq('noticeId', attempt.noticeId).eq('recipientUserId', attempt.recipientUserId)
      )
      .collect();
    const sentOrSkippedAttempt = existingAttempts.find(
      (existingAttempt) => existingAttempt.status === 'sent' || existingAttempt.status === 'skipped'
    );
    const pendingAttempt = existingAttempts.find((existingAttempt) => existingAttempt.status === 'pending');

    if (attempt.status === 'pending') {
      const claimedAttempt = sentOrSkippedAttempt ?? pendingAttempt;

      if (claimedAttempt) {
        return { claimed: false as const, inserted: false as const, id: claimedAttempt._id };
      }

      const retryableAttempt = existingAttempts[0];
      if (retryableAttempt) {
        await ctx.db.patch(retryableAttempt._id, attempt);
        return { claimed: true as const, inserted: false as const, id: retryableAttempt._id };
      }

      const id = await ctx.db.insert('emailNoticeDeliveryAttempts', attempt);
      return { claimed: true as const, inserted: true as const, id };
    }

    if (sentOrSkippedAttempt) {
      return { claimed: false as const, inserted: false as const, id: sentOrSkippedAttempt._id };
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

    const id = await ctx.db.insert('emailNoticeDeliveryAttempts', attempt);
    return { claimed: true as const, inserted: true as const, id };
  }
});
