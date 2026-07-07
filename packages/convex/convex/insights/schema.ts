import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const spendingInsightDeliveryAttemptsTable = defineTable({
  monthKey: v.string(),
  recipientUserId: v.string(),
  attemptedAt: v.number(),
  status: v.union(v.literal('pending'), v.literal('sent'), v.literal('skipped'), v.literal('failed')),
  providerErrorCode: v.optional(v.string())
})
  .index('by_month_key', ['monthKey'])
  .index('by_month_recipient', ['monthKey', 'recipientUserId']);

export const spendingInsightsTable = defineTable({
  monthKey: v.string(),
  headline: v.string(),
  observations: v.array(v.string()),
  prediction: v.string(),
  generatedAt: v.number(),
  model: v.string()
}).index('by_month_key', ['monthKey']);
