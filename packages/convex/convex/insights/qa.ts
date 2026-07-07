import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { action, internalQuery } from '../_generated/server';
import { monthKeyFromTimestamp } from '../spendingSummary';
import {
  buildSpendingInsightAiInput,
  type SpendingInsightAiMonth,
  type SpendingInsightBreakdownRow,
  type SpendingInsightBudgetRow,
  trailingSpendingInsightMonthKeys
} from './assembly';
import type { StoredSpendingInsightRow } from './generation';
import { pickLatestSpendingInsight } from './latest';

/**
 * The grounding for one spending insight question: the stored latest monthly
 * spending insight plus the trailing months of data that produced it. Null when
 * no insight has been generated yet.
 */
export type SpendingInsightQaSource = {
  insight: StoredSpendingInsightRow;
  months: SpendingInsightAiMonth[];
} | null;

/**
 * The exact payload sent to the AI: the user's question plus only the stored
 * insight text and the months that produced it, so answers cannot draw on
 * anything else.
 */
export type SpendingInsightQaAiInput = {
  question: string;
  insight: {
    monthKey: string;
    headline: string;
    observations: string[];
    prediction: string;
  };
  months: SpendingInsightAiMonth[];
};

export type SpendingInsightQaAiProvider = (input: SpendingInsightQaAiInput) => Promise<unknown>;

/**
 * Grounds question answering on the latest stored insight plus the same
 * trailing-month window the generation sweep would have fed the AI for that
 * month, so answers never draw on data the insight itself could not see.
 */
export function buildSpendingInsightQaSource({
  insightRows,
  breakdownRows,
  budgetRows
}: {
  insightRows: StoredSpendingInsightRow[];
  breakdownRows: SpendingInsightBreakdownRow[];
  budgetRows: SpendingInsightBudgetRow[];
}): SpendingInsightQaSource {
  const insight = pickLatestSpendingInsight(insightRows);
  if (!insight) return null;

  const { months } = buildSpendingInsightAiInput({
    targetMonthKey: insight.monthKey,
    breakdownRows,
    budgetRows
  });

  return { insight, months };
}

export const spendingInsightQaSystemPrompt = [
  'You answer one question about a household monthly spending insight.',
  'Your reader is a family member on their phone; keep the answer short, warm, and in plain everyday language with no financial jargon.',
  'Ground every statement in the supplied insight and months. Do not invent figures, categories, merchants, or private details beyond the input.',
  'Amounts are AUD.',
  'If the supplied insight and months do not cover the question, say so plainly instead of guessing.',
  'Return only the requested structured object.'
].join('\n');

export const spendingInsightQaOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['answer'],
  properties: {
    answer: { type: 'string' }
  }
} as const;

export function createOpenAiSpendingInsightAnswerProvider({
  apiKey,
  model,
  fetchImpl = fetch
}: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): SpendingInsightQaAiProvider {
  return async (input) => {
    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: spendingInsightQaSystemPrompt },
          { role: 'user', content: JSON.stringify(input) }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'monthly_spending_insight_answer',
            strict: true,
            schema: spendingInsightQaOutputJsonSchema
          }
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Spending insight answer AI request failed with status ${response.status}`);
    }
    const body = (await response.json()) as unknown;
    const content = openAiMessageContent(body);
    if (!content) throw new Error('Spending insight answer AI response did not include JSON content');
    return JSON.parse(content) as unknown;
  };
}

function openAiMessageContent(body: unknown) {
  if (typeof body !== 'object' || body === null) return null;
  const choices = (body as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return null;
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  return typeof message?.content === 'string' ? message.content : null;
}

export type SpendingInsightAnswerResult =
  | { status: 'answered'; answer: string }
  | { status: 'no_insight' }
  | { status: 'setup_problem' }
  | { status: 'failed'; reason: 'provider_failure' | 'invalid_ai_output' };

export async function answerSpendingInsightQuestion({
  question,
  source,
  provider
}: {
  question: string;
  source: SpendingInsightQaSource;
  provider: SpendingInsightQaAiProvider | null;
}): Promise<SpendingInsightAnswerResult> {
  if (!source) return { status: 'no_insight' };
  if (!provider) return { status: 'setup_problem' };

  let aiResponse: unknown;
  try {
    aiResponse = await provider({
      question,
      insight: {
        monthKey: source.insight.monthKey,
        headline: source.insight.headline,
        observations: source.insight.observations,
        prediction: source.insight.prediction
      },
      months: source.months
    });
  } catch (error) {
    console.error('[insights.qa] Spending insight answer provider failed', {
      monthKey: source.insight.monthKey,
      error: error instanceof Error ? error.message : String(error)
    });
    return { status: 'failed', reason: 'provider_failure' };
  }

  const answer = parseSpendingInsightAnswer(aiResponse);
  if (!answer) {
    console.error('[insights.qa] Spending insight answer output was invalid', {
      monthKey: source.insight.monthKey
    });
    return { status: 'failed', reason: 'invalid_ai_output' };
  }

  return { status: 'answered', answer };
}

function parseSpendingInsightAnswer(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const answer = (value as Record<string, unknown>).answer;
  if (typeof answer !== 'string' || answer.trim().length === 0) return null;
  return answer;
}

function assertAuthorizedServiceToken(serviceToken: string) {
  const expectedToken = process.env.BOT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) {
    throw new Error('Unauthorized');
  }
}

function spendingInsightAnswerProviderFromEnv(): SpendingInsightQaAiProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.SPENDING_INSIGHT_AI_MODEL;
  if (!apiKey || !model) return null;
  return createOpenAiSpendingInsightAnswerProvider({ apiKey, model });
}

// Exported so the service-token guard is tested directly, independent of the
// Convex function wrappers below.
export async function answerSpendingInsightQuestionForBotHandler({
  serviceToken,
  question,
  loadSource,
  provider
}: {
  serviceToken: string;
  question: string;
  loadSource: () => Promise<SpendingInsightQaSource>;
  provider: SpendingInsightQaAiProvider | null;
}): Promise<SpendingInsightAnswerResult> {
  assertAuthorizedServiceToken(serviceToken);
  const source = await loadSource();
  return answerSpendingInsightQuestion({ question, source, provider });
}

type QaRefs = {
  spendingInsightQaSource: FunctionReference<'query', 'internal', Record<string, never>, SpendingInsightQaSource>;
};

const qaRefs: QaRefs = (
  internal as unknown as {
    insights: {
      qa: QaRefs;
    };
  }
).insights.qa;

export const spendingInsightQaSource = internalQuery({
  args: {},
  handler: async (ctx): Promise<SpendingInsightQaSource> => {
    const insightRows = await ctx.db.query('spendingInsights').collect();
    const insight = pickLatestSpendingInsight(insightRows);
    if (!insight) return null;

    // Only the insight's trailing window feeds the grounding payload; keep it
    // bounded as history accumulates, mirroring the generation sweep.
    const windowMonthKeys = new Set(trailingSpendingInsightMonthKeys(insight.monthKey));
    const breakdownRows = await ctx.db.query('spendCategoryBreakdown').collect();
    const budgetRows = await ctx.db.query('budget').collect();

    return buildSpendingInsightQaSource({
      insightRows,
      breakdownRows: breakdownRows
        .filter((row) => windowMonthKeys.has(row.monthKey))
        .map((row) => ({ monthKey: row.monthKey, category: row.category, amount: row.amount })),
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
    });
  }
});

export const answerSpendingInsightQuestionForBot = action({
  args: {
    serviceToken: v.string(),
    question: v.string()
  },
  handler: async (ctx, { serviceToken, question }): Promise<SpendingInsightAnswerResult> => {
    return await answerSpendingInsightQuestionForBotHandler({
      serviceToken,
      question,
      loadSource: () => ctx.runQuery(qaRefs.spendingInsightQaSource),
      provider: spendingInsightAnswerProviderFromEnv()
    });
  }
});
