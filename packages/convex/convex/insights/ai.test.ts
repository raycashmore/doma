import { describe, expect, it, vi } from 'vitest';

import {
  createOpenAiSpendingInsightProvider,
  parseSpendingInsight,
  spendingInsightOutputJsonSchema,
  spendingInsightSystemPrompt
} from './ai';
import type { SpendingInsightAiInput } from './assembly';

const validOutput = {
  headline: 'Grocery creep is quietly offsetting the transport savings.',
  observations: [
    'Groceries have risen for four consecutive months while transport fell.',
    'Subscriptions spike every third month in a billing cycle pattern.'
  ],
  prediction: 'Card spend should land slightly above the trailing average next month.'
};

describe('parseSpendingInsight', () => {
  it('parses a valid response into a typed insight', () => {
    expect(parseSpendingInsight(validOutput)).toEqual({ insight: validOutput });
  });

  it('rejects a non-object response', () => {
    expect(parseSpendingInsight('nope')).toEqual({ insight: null, failure: { reason: 'not_object' } });
  });

  it('rejects an empty headline or prediction', () => {
    expect(parseSpendingInsight({ ...validOutput, headline: '   ' })).toEqual({
      insight: null,
      failure: { reason: 'invalid_headline' }
    });
    expect(parseSpendingInsight({ ...validOutput, prediction: '' })).toEqual({
      insight: null,
      failure: { reason: 'invalid_prediction' }
    });
  });

  it('rejects observations outside the 2-4 range or with empty entries', () => {
    expect(parseSpendingInsight({ ...validOutput, observations: ['Only one observation.'] })).toEqual({
      insight: null,
      failure: { reason: 'invalid_observations' }
    });
    expect(
      parseSpendingInsight({
        ...validOutput,
        observations: ['One.', 'Two.', 'Three.', 'Four.', 'Five.']
      })
    ).toEqual({
      insight: null,
      failure: { reason: 'invalid_observations' }
    });
    expect(parseSpendingInsight({ ...validOutput, observations: ['Fine.', '   '] })).toEqual({
      insight: null,
      failure: { reason: 'invalid_observations' }
    });
  });
});

describe('spendingInsightSystemPrompt', () => {
  it('steers toward meaningful patterns rather than a category list', () => {
    expect(spendingInsightSystemPrompt).toMatch(/meaningful patterns/i);
    expect(spendingInsightSystemPrompt).toMatch(/moving together|one-month pause|staying high/i);
    expect(spendingInsightSystemPrompt).toMatch(/do not merely list/i);
  });

  it('asks for exactly one next-month prediction', () => {
    expect(spendingInsightSystemPrompt).toMatch(/one .*prediction|exactly one prediction/i);
    expect(spendingInsightSystemPrompt).toMatch(/next month/i);
  });

  it('forbids inventing data beyond the supplied input', () => {
    expect(spendingInsightSystemPrompt).toMatch(/do not invent|never invent/i);
  });

  it('demands a brief, plain-language family update with supplied percentage and year-on-year comparisons', () => {
    expect(spendingInsightSystemPrompt).toMatch(/everyday|plain/i);
    expect(spendingInsightSystemPrompt).toMatch(/jargon/i);
    expect(spendingInsightSystemPrompt).toMatch(/busy|phone/i);
    expect(spendingInsightSystemPrompt).toMatch(/warm|friendly/i);
    expect(spendingInsightSystemPrompt).toMatch(/comparisonSummary/i);
    expect(spendingInsightSystemPrompt).toMatch(/never calculate percentages/i);
    expect(spendingInsightSystemPrompt).toMatch(/\(up 20%\)/i);
    expect(spendingInsightSystemPrompt).toMatch(/same month last year/i);
    expect(spendingInsightSystemPrompt).toMatch(/This month/i);
  });
});

describe('spendingInsightOutputJsonSchema', () => {
  it('is a strict object schema of headline, observations, and prediction', () => {
    expect(spendingInsightOutputJsonSchema.type).toBe('object');
    expect(spendingInsightOutputJsonSchema.additionalProperties).toBe(false);
    expect(spendingInsightOutputJsonSchema.required).toEqual(['headline', 'observations', 'prediction']);
    expect(spendingInsightOutputJsonSchema.properties.observations).toMatchObject({
      type: 'array',
      items: { type: 'string' }
    });
  });
});

describe('createOpenAiSpendingInsightProvider', () => {
  const input: SpendingInsightAiInput = {
    targetMonthKey: '2026-06',
    months: [
      {
        monthKey: '2026-06',
        monthLabel: 'June 2026',
        categories: [{ category: 'Groceries', amount: 1200.5 }]
      }
    ]
  };

  it('sends the system prompt, input, and strict JSON schema, and returns parsed message content', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ headline: 'h', observations: [], prediction: 'p' }) } }]
      })
    })) as unknown as typeof fetch;

    const provider = createOpenAiSpendingInsightProvider({ apiKey: 'key', model: 'test-model', fetchImpl });
    await expect(provider(input)).resolves.toEqual({ headline: 'h', observations: [], prediction: 'p' });

    const [url, request] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { body: string; headers: Record<string, string> }
    ];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(request.headers.authorization).toBe('Bearer key');
    const body = JSON.parse(request.body) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      response_format: { type: string; json_schema: { strict: boolean } };
    };
    expect(body.model).toBe('test-model');
    expect(body.messages[0]).toEqual({ role: 'system', content: spendingInsightSystemPrompt });
    expect(body.messages[1]).toEqual({ role: 'user', content: JSON.stringify(input) });
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
  });

  it('throws when the response is not ok', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const provider = createOpenAiSpendingInsightProvider({ apiKey: 'key', model: 'test-model', fetchImpl });
    await expect(provider(input)).rejects.toThrow('status 500');
  });

  it('throws when the response has no JSON content', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [] }) })) as unknown as typeof fetch;
    const provider = createOpenAiSpendingInsightProvider({ apiKey: 'key', model: 'test-model', fetchImpl });
    await expect(provider(input)).rejects.toThrow('did not include JSON content');
  });
});
