import { v } from 'convex/values';

import { internalMutation, internalQuery } from '../_generated/server';
import { type EmailNoticeDeliveryAttemptStatus, emailNoticeDeliveryPendingLeaseMs } from './delivery';

type StoredEmailNoticeDeliveryAttempt<TId extends string = string> = {
  _id: TId;
  noticeId: string;
  recipientUserId: string;
  attemptedAt: number;
  status: EmailNoticeDeliveryAttemptStatus;
};

type EmailNoticeDeliveryAttemptWrite = {
  noticeId: string;
  recipientUserId: string;
  attemptedAt: number;
  status: EmailNoticeDeliveryAttemptStatus;
  providerErrorCode?: string;
};

type AttemptWriteDecision<TId extends string = string> =
  | { operation: 'insert'; claimed: true }
  | { operation: 'patch'; claimed: true; id: TId }
  | { operation: 'skip'; claimed: false; id: TId };

function isActivePendingAttempt<TId extends string>(attempt: StoredEmailNoticeDeliveryAttempt<TId>, nowMs: number) {
  return attempt.status === 'pending' && nowMs - attempt.attemptedAt < emailNoticeDeliveryPendingLeaseMs;
}

export function selectEmailNoticeDeliveryAttemptWrite<TId extends string>({
  existingAttempts,
  attempt
}: {
  existingAttempts: StoredEmailNoticeDeliveryAttempt<TId>[];
  attempt: EmailNoticeDeliveryAttemptWrite;
}): AttemptWriteDecision<TId> {
  const sentOrSkippedAttempt = existingAttempts.find(
    (existingAttempt) => existingAttempt.status === 'sent' || existingAttempt.status === 'skipped'
  );
  const pendingAttempt = existingAttempts.find((existingAttempt) => existingAttempt.status === 'pending');

  if (attempt.status === 'pending') {
    const activePendingAttempt =
      pendingAttempt && isActivePendingAttempt(pendingAttempt, attempt.attemptedAt) ? pendingAttempt : undefined;
    const claimedAttempt = sentOrSkippedAttempt ?? activePendingAttempt;

    if (claimedAttempt) {
      return { operation: 'skip', claimed: false, id: claimedAttempt._id };
    }

    const retryableAttempt = pendingAttempt ?? existingAttempts[0];
    if (retryableAttempt) {
      return { operation: 'patch', claimed: true, id: retryableAttempt._id };
    }

    return { operation: 'insert', claimed: true };
  }

  if (sentOrSkippedAttempt) {
    return { operation: 'skip', claimed: false, id: sentOrSkippedAttempt._id };
  }

  const retryableAttempt = pendingAttempt ?? existingAttempts[0];
  if (retryableAttempt) {
    return { operation: 'patch', claimed: true, id: retryableAttempt._id };
  }

  return { operation: 'insert', claimed: true };
}

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
    const activeNoticeIds = new Set(activeNotices.map((notice) => notice._id));
    const attempts = (await ctx.db.query('emailNoticeDeliveryAttempts').collect()).filter((attempt) =>
      activeNoticeIds.has(attempt.noticeId)
    );

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
    const decision = selectEmailNoticeDeliveryAttemptWrite({
      existingAttempts,
      attempt
    });

    if (decision.operation === 'skip') {
      return { claimed: false as const, inserted: false as const, id: decision.id };
    }

    if (decision.operation === 'patch') {
      await ctx.db.patch(decision.id, attempt);
      return { claimed: true as const, inserted: false as const, id: decision.id };
    }

    const id = await ctx.db.insert('emailNoticeDeliveryAttempts', attempt);
    return { claimed: true as const, inserted: true as const, id };
  }
});
