import { v } from 'convex/values';

import { internalMutation, internalQuery } from '../_generated/server';
import { type SpendingInsightDeliveryAttemptStatus, spendingInsightDeliveryPendingLeaseMs } from './delivery';

type StoredSpendingInsightDeliveryAttempt<TId extends string = string> = {
  _id: TId;
  monthKey: string;
  recipientUserId: string;
  attemptedAt: number;
  status: SpendingInsightDeliveryAttemptStatus;
};

type SpendingInsightDeliveryAttemptWrite = {
  monthKey: string;
  recipientUserId: string;
  attemptedAt: number;
  status: SpendingInsightDeliveryAttemptStatus;
  providerErrorCode?: string;
};

export function latestSpendingInsightForDelivery<
  TInsight extends {
    monthKey: string;
  }
>(insights: TInsight[]): TInsight | null {
  let latest: TInsight | null = null;
  for (const insight of insights) {
    if (!latest || insight.monthKey > latest.monthKey) latest = insight;
  }
  return latest;
}

type AttemptWriteDecision<TId extends string = string> =
  | { operation: 'insert'; claimed: true }
  | { operation: 'patch'; claimed: true; id: TId }
  | { operation: 'skip'; claimed: false; id: TId };

export function selectSpendingInsightDeliveryAttemptWrite<TId extends string>({
  existingAttempts,
  attempt
}: {
  existingAttempts: StoredSpendingInsightDeliveryAttempt<TId>[];
  attempt: SpendingInsightDeliveryAttemptWrite;
}): AttemptWriteDecision<TId> {
  const completedAttempt = existingAttempts.find(
    (existingAttempt) => existingAttempt.status === 'sent' || existingAttempt.status === 'skipped'
  );
  const pendingAttempt = existingAttempts.find((existingAttempt) => existingAttempt.status === 'pending');

  if (completedAttempt) {
    return { operation: 'skip', claimed: false, id: completedAttempt._id };
  }

  if (attempt.status === 'pending') {
    const activePendingAttempt =
      pendingAttempt && attempt.attemptedAt - pendingAttempt.attemptedAt < spendingInsightDeliveryPendingLeaseMs
        ? pendingAttempt
        : undefined;

    if (activePendingAttempt) {
      return { operation: 'skip', claimed: false, id: activePendingAttempt._id };
    }
  }

  const retryableAttempt = pendingAttempt ?? existingAttempts[0];
  if (retryableAttempt) {
    return { operation: 'patch', claimed: true, id: retryableAttempt._id };
  }

  return { operation: 'insert', claimed: true };
}

export const spendingInsightDeliveryRunInputs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const insightRows = await ctx.db.query('spendingInsights').collect();
    const latest = latestSpendingInsightForDelivery(insightRows);
    if (!latest) return { insight: null, attempts: [] };

    const attempts = await ctx.db
      .query('spendingInsightDeliveryAttempts')
      .withIndex('by_month_key', (q) => q.eq('monthKey', latest.monthKey))
      .collect();

    return {
      insight: {
        monthKey: latest.monthKey,
        headline: latest.headline,
        observations: latest.observations,
        prediction: latest.prediction
      },
      attempts: attempts.map((attempt) => ({
        monthKey: attempt.monthKey,
        recipientUserId: attempt.recipientUserId,
        attemptedAt: attempt.attemptedAt,
        status: attempt.status
      }))
    };
  }
});

export const recordSpendingInsightDeliveryAttempt = internalMutation({
  args: {
    monthKey: v.string(),
    recipientUserId: v.string(),
    attemptedAt: v.number(),
    status: v.union(v.literal('pending'), v.literal('sent'), v.literal('skipped'), v.literal('failed')),
    providerErrorCode: v.optional(v.string())
  },
  handler: async (ctx, attempt) => {
    const existingAttempts = await ctx.db
      .query('spendingInsightDeliveryAttempts')
      .withIndex('by_month_recipient', (q) =>
        q.eq('monthKey', attempt.monthKey).eq('recipientUserId', attempt.recipientUserId)
      )
      .collect();
    const decision = selectSpendingInsightDeliveryAttemptWrite({
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

    const id = await ctx.db.insert('spendingInsightDeliveryAttempts', attempt);
    return { claimed: true as const, inserted: true as const, id };
  }
});
