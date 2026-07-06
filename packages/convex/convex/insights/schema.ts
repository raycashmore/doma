import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const spendingInsightsTable = defineTable({
  monthKey: v.string(),
  headline: v.string(),
  observations: v.array(v.string()),
  prediction: v.string(),
  generatedAt: v.number(),
  model: v.string()
}).index('by_month_key', ['monthKey']);
