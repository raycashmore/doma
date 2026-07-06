import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { internalAction, internalMutation, internalQuery } from '../_generated/server';
import { monthKeyFromTimestamp } from '../spendingSummary';
import { createOpenAiSpendingInsightProvider, parseSpendingInsight, type SpendingInsightAiProvider } from './ai';
import {
  buildSpendingInsightAiInput,
  latestMonthKeyNeedingInsight,
  type SpendingInsightBreakdownRow,
  type SpendingInsightBudgetRow,
  trailingSpendingInsightMonthKeys
} from './assembly';

export type SpendingInsightSweepSource = {
  targetMonthKey: string;
  breakdownRows: SpendingInsightBreakdownRow[];
  budgetRows: SpendingInsightBudgetRow[];
};

export type StoredSpendingInsightRow = {
  monthKey: string;
  headline: string;
  observations: string[];
  prediction: string;
  generatedAt: number;
  model: string;
};

export type SpendingInsightSweepResult =
  | { status: 'idle' }
  | { status: 'skipped'; reason: 'setup_problem' }
  | { status: 'failed'; monthKey: string; reason: 'provider_failure' | 'invalid_ai_output' }
  | { status: 'generated'; monthKey: string; inserted: boolean };

export type SpendingInsightStoreCtx = {
  db: {
    query(table: 'spendingInsights'): {
      withIndex(
        index: 'by_month_key',
        apply: (q: { eq(field: 'monthKey', value: string): unknown }) => unknown
      ): {
        unique(): Promise<{ _id: string; monthKey: string } | null>;
      };
    };
    insert(table: 'spendingInsights', row: StoredSpendingInsightRow): Promise<string>;
  };
};

type GenerationRefs = {
  spendingInsightSweepSource: FunctionReference<
    'query',
    'internal',
    Record<string, never>,
    SpendingInsightSweepSource | null
  >;
  storeSpendingInsight: FunctionReference<
    'mutation',
    'internal',
    StoredSpendingInsightRow,
    { inserted: boolean; id: string }
  >;
};

const generationRefs: GenerationRefs = (
  internal as unknown as {
    insights: {
      generation: GenerationRefs;
    };
  }
).insights.generation;

export async function runSpendingInsightSweep({
  sweepSource,
  provider,
  storeInsight,
  generatedAt
}: {
  sweepSource: SpendingInsightSweepSource | null;
  provider: { generate: SpendingInsightAiProvider; model: string } | null;
  storeInsight: (row: StoredSpendingInsightRow) => Promise<{ inserted: boolean }>;
  generatedAt: number;
}): Promise<SpendingInsightSweepResult> {
  if (!sweepSource) return { status: 'idle' };
  if (!provider) return { status: 'skipped', reason: 'setup_problem' };

  const { targetMonthKey, breakdownRows, budgetRows } = sweepSource;
  const input = buildSpendingInsightAiInput({ targetMonthKey, breakdownRows, budgetRows });

  let aiResponse: unknown;
  try {
    aiResponse = await provider.generate(input);
  } catch (error) {
    console.error('[insights.generation] Spending insight AI provider failed', {
      monthKey: targetMonthKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return { status: 'failed', monthKey: targetMonthKey, reason: 'provider_failure' };
  }

  const parsed = parseSpendingInsight(aiResponse);
  if (!parsed.insight) {
    console.error('[insights.generation] Spending insight AI output was invalid', {
      monthKey: targetMonthKey,
      parseFailure: parsed.failure
    });
    return { status: 'failed', monthKey: targetMonthKey, reason: 'invalid_ai_output' };
  }

  const { inserted } = await storeInsight({
    monthKey: targetMonthKey,
    headline: parsed.insight.headline,
    observations: parsed.insight.observations,
    prediction: parsed.insight.prediction,
    generatedAt,
    model: provider.model
  });

  return { status: 'generated', monthKey: targetMonthKey, inserted };
}

export async function storeSpendingInsightHandler(ctx: SpendingInsightStoreCtx, row: StoredSpendingInsightRow) {
  const existing = await ctx.db
    .query('spendingInsights')
    .withIndex('by_month_key', (q) => q.eq('monthKey', row.monthKey))
    .unique();
  if (existing) return { inserted: false as const, id: existing._id };

  const id = await ctx.db.insert('spendingInsights', row);
  return { inserted: true as const, id };
}

function spendingInsightProviderFromEnv() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.SPENDING_INSIGHT_AI_MODEL;
  if (!apiKey || !model) return null;
  return { generate: createOpenAiSpendingInsightProvider({ apiKey, model }), model };
}

export const spendingInsightSweepSource = internalQuery({
  args: {},
  handler: async (ctx): Promise<SpendingInsightSweepSource | null> => {
    const breakdownRows = await ctx.db.query('spendCategoryBreakdown').collect();
    const insightRows = await ctx.db.query('spendingInsights').collect();
    const budgetRows = await ctx.db.query('budget').collect();
    const targetMonthKey = latestMonthKeyNeedingInsight({
      breakdownMonthKeys: breakdownRows.map((row) => row.monthKey),
      budgetMonthKeys: budgetRows.map((row) => monthKeyFromTimestamp(row.date)),
      insightMonthKeys: insightRows.map((row) => row.monthKey)
    });
    if (!targetMonthKey) return null;

    // Only the trailing window feeds the AI input; keep the payload bounded
    // as history accumulates.
    const windowMonthKeys = new Set(trailingSpendingInsightMonthKeys(targetMonthKey));
    return {
      targetMonthKey,
      breakdownRows: breakdownRows
        .filter((row) => windowMonthKeys.has(row.monthKey))
        .map((row) => ({
          monthKey: row.monthKey,
          category: row.category,
          amount: row.amount
        })),
      budgetRows: budgetRows
        .filter((row) => windowMonthKeys.has(monthKeyFromTimestamp(row.date)))
        .map((row) => ({
          date: row.date,
          incomePrimary: row.incomePrimary,
          incomeSecondary: row.incomeSecondary,
          billContrib: row.billContrib,
          credit1: row.credit1,
          credit2: row.credit2,
          credit3: row.credit3,
          oneOffs: row.oneOffs
        }))
    };
  }
});

export const storeSpendingInsight = internalMutation({
  args: {
    monthKey: v.string(),
    headline: v.string(),
    observations: v.array(v.string()),
    prediction: v.string(),
    generatedAt: v.number(),
    model: v.string()
  },
  handler: async (ctx, row) => {
    return await storeSpendingInsightHandler(ctx as unknown as SpendingInsightStoreCtx, row);
  }
});

export const runDueSpendingInsightSweep = internalAction({
  args: {},
  handler: async (ctx): Promise<SpendingInsightSweepResult> => {
    const sweepSource = await ctx.runQuery(generationRefs.spendingInsightSweepSource);
    return await runSpendingInsightSweep({
      sweepSource,
      provider: spendingInsightProviderFromEnv(),
      storeInsight: (row) => ctx.runMutation(generationRefs.storeSpendingInsight, row),
      generatedAt: Date.now()
    });
  }
});
