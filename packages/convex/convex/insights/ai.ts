import type { SpendingInsightAiInput } from './assembly';

export type SpendingInsight = {
  headline: string;
  observations: string[];
  prediction: string;
};

export type SpendingInsightParseFailure = {
  reason: 'not_object' | 'invalid_headline' | 'invalid_observations' | 'invalid_prediction';
};

export type SpendingInsightParseResult =
  | { insight: SpendingInsight }
  | { insight: null; failure: SpendingInsightParseFailure };

export type SpendingInsightAiProvider = (input: SpendingInsightAiInput) => Promise<unknown>;

const minObservations = 2;
const maxObservations = 4;

export const spendingInsightSystemPrompt = [
  'You write a short monthly spending insight for a household finance dashboard.',
  'Surface non-obvious hidden patterns in the supplied months: multi-month creep, cyclical spikes, and category trade-offs.',
  'Do not state the obvious. Never restate a single month total or name the biggest category without a pattern behind it.',
  'Amounts are AUD. Compare months and categories across the window, not in isolation.',
  'Write 2 to 4 observations, each one grounded in the supplied numbers.',
  'Write exactly one prediction for next month, stated concretely enough to be checked against next month.',
  'Use only the supplied categories and budget totals. Do not invent data, merchants, or private details beyond the input.',
  'Return only the requested structured object.'
].join('\n');

export const spendingInsightOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'observations', 'prediction'],
  properties: {
    headline: { type: 'string' },
    observations: { type: 'array', items: { type: 'string' } },
    prediction: { type: 'string' }
  }
} as const;

export function createOpenAiSpendingInsightProvider({
  apiKey,
  model,
  fetchImpl = fetch
}: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): SpendingInsightAiProvider {
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
          { role: 'system', content: spendingInsightSystemPrompt },
          { role: 'user', content: JSON.stringify(input) }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'monthly_spending_insight',
            strict: true,
            schema: spendingInsightOutputJsonSchema
          }
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Spending insight AI request failed with status ${response.status}`);
    }
    const body = (await response.json()) as unknown;
    const content = openAiMessageContent(body);
    if (!content) throw new Error('Spending insight AI response did not include JSON content');
    return JSON.parse(content) as unknown;
  };
}

function openAiMessageContent(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.choices)) return null;
  const firstChoice = body.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
  return typeof firstChoice.message.content === 'string' ? firstChoice.message.content : null;
}

export function parseSpendingInsight(value: unknown): SpendingInsightParseResult {
  if (!isRecord(value)) return { insight: null, failure: { reason: 'not_object' } };
  if (!isNonEmptyString(value.headline)) return { insight: null, failure: { reason: 'invalid_headline' } };
  if (
    !Array.isArray(value.observations) ||
    value.observations.length < minObservations ||
    value.observations.length > maxObservations ||
    !value.observations.every(isNonEmptyString)
  ) {
    return { insight: null, failure: { reason: 'invalid_observations' } };
  }
  if (!isNonEmptyString(value.prediction)) return { insight: null, failure: { reason: 'invalid_prediction' } };

  return {
    insight: {
      headline: value.headline,
      observations: value.observations,
      prediction: value.prediction
    }
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
