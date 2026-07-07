import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  answerSpendingInsightQuestion,
  answerSpendingInsightQuestionForBotHandler,
  buildSpendingInsightQaSource,
  createOpenAiSpendingInsightAnswerProvider,
  type SpendingInsightQaSource,
  spendingInsightQaSystemPrompt
} from './qa';

const qaSource: SpendingInsightQaSource = {
  insight: {
    monthKey: '2026-06',
    headline: 'Grocery creep is quietly offsetting the transport savings.',
    observations: [
      'Groceries have risen for four consecutive months while transport fell.',
      'Subscriptions spike every third month in a billing cycle pattern.'
    ],
    prediction: 'Card spend should land slightly above the trailing average next month.',
    generatedAt: 1_700_000_000_000,
    model: 'test-model'
  },
  months: [
    {
      monthKey: '2026-06',
      monthLabel: 'June 2026',
      categories: [{ category: 'Groceries', amount: 1200.5 }]
    }
  ]
};

describe('answerSpendingInsightQuestion', () => {
  it('says there is no insight yet when none is stored', async () => {
    const provider = vi.fn();

    await expect(
      answerSpendingInsightQuestion({
        question: 'what did the insights say about groceries?',
        source: null,
        provider
      })
    ).resolves.toEqual({ status: 'no_insight' });
    expect(provider).not.toHaveBeenCalled();
  });

  it('answers the question grounded in the stored insight and its months', async () => {
    const provider = vi.fn(async () => ({ answer: 'Groceries rose four months running, per the June insight.' }));

    const result = await answerSpendingInsightQuestion({
      question: 'what did the insights say about groceries?',
      source: qaSource,
      provider
    });

    expect(result).toEqual({
      status: 'answered',
      answer: 'Groceries rose four months running, per the June insight.'
    });
    expect(provider).toHaveBeenCalledWith({
      question: 'what did the insights say about groceries?',
      insight: {
        monthKey: qaSource!.insight.monthKey,
        headline: qaSource!.insight.headline,
        observations: qaSource!.insight.observations,
        prediction: qaSource!.insight.prediction
      },
      months: qaSource!.months
    });
  });

  it('reports a setup problem when no provider is configured', async () => {
    await expect(
      answerSpendingInsightQuestion({ question: 'how is spending?', source: qaSource, provider: null })
    ).resolves.toEqual({ status: 'setup_problem' });
  });

  it('fails without an answer when the provider throws', async () => {
    const provider = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(
      answerSpendingInsightQuestion({ question: 'how is spending?', source: qaSource, provider })
    ).resolves.toEqual({ status: 'failed', reason: 'provider_failure' });
  });

  it('fails without an answer when the provider output has no usable text', async () => {
    const provider = vi.fn(async () => ({ answer: '   ' }));

    await expect(
      answerSpendingInsightQuestion({ question: 'how is spending?', source: qaSource, provider })
    ).resolves.toEqual({ status: 'failed', reason: 'invalid_ai_output' });
  });
});

describe('buildSpendingInsightQaSource', () => {
  const insightRow = (monthKey: string) => ({
    monthKey,
    headline: `Headline for ${monthKey}`,
    observations: ['First pattern.', 'Second pattern.'],
    prediction: 'A prediction.',
    generatedAt: 1_700_000_000_000,
    model: 'test-model'
  });

  it('returns null when no insight is stored', () => {
    expect(buildSpendingInsightQaSource({ insightRows: [], breakdownRows: [], budgetRows: [] })).toBeNull();
  });

  it('grounds on the latest insight and only its trailing months of data', () => {
    const source = buildSpendingInsightQaSource({
      insightRows: [insightRow('2026-05'), insightRow('2026-06')],
      breakdownRows: [
        { monthKey: '2026-06', category: 'Groceries', amount: 120_050 },
        // Outside the trailing twelve-month window of 2026-06: must not leak in.
        { monthKey: '2024-01', category: 'Groceries', amount: 99_900 }
      ],
      budgetRows: []
    });

    expect(source).not.toBeNull();
    expect(source!.insight.monthKey).toBe('2026-06');
    expect(source!.months).toEqual([
      {
        monthKey: '2026-06',
        monthLabel: 'June 2026',
        categories: [{ category: 'Groceries', amount: 1200.5 }]
      }
    ]);
  });
});

describe('answerSpendingInsightQuestionForBotHandler', () => {
  afterEach(() => {
    delete process.env.BOT_SERVICE_TOKEN;
  });

  it('rejects a request without the expected service token', async () => {
    process.env.BOT_SERVICE_TOKEN = 'expected-token';
    const loadSource = vi.fn();

    await expect(
      answerSpendingInsightQuestionForBotHandler({
        serviceToken: 'wrong-token',
        question: 'how is spending?',
        loadSource,
        provider: null
      })
    ).rejects.toThrow(/unauthorized/i);
    expect(loadSource).not.toHaveBeenCalled();
  });

  it('answers through the loaded source when the token matches', async () => {
    process.env.BOT_SERVICE_TOKEN = 'expected-token';
    const loadSource = vi.fn(async () => qaSource);
    const provider = vi.fn(async () => ({ answer: 'All steady.' }));

    await expect(
      answerSpendingInsightQuestionForBotHandler({
        serviceToken: 'expected-token',
        question: 'how is spending?',
        loadSource,
        provider
      })
    ).resolves.toEqual({ status: 'answered', answer: 'All steady.' });
  });
});

describe('spendingInsightQaSystemPrompt', () => {
  it('forbids inventing figures and grounds answers in the supplied data only', () => {
    expect(spendingInsightQaSystemPrompt).toMatch(/do not invent|never invent/i);
    expect(spendingInsightQaSystemPrompt).toMatch(/supplied|provided/i);
  });

  it('tells the model to admit when the supplied data cannot answer', () => {
    expect(spendingInsightQaSystemPrompt).toMatch(/say so|cannot answer|does not cover/i);
  });
});

describe('createOpenAiSpendingInsightAnswerProvider', () => {
  it('requests a strict structured answer grounded in the QA input', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ answer: 'Groceries rose four months running.' }) } }]
      })
    })) as unknown as typeof fetch;

    const provider = createOpenAiSpendingInsightAnswerProvider({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl
    });
    const input = {
      question: 'what did the insights say about groceries?',
      insight: {
        monthKey: qaSource!.insight.monthKey,
        headline: qaSource!.insight.headline,
        observations: qaSource!.insight.observations,
        prediction: qaSource!.insight.prediction
      },
      months: qaSource!.months
    };

    await expect(provider(input)).resolves.toEqual({ answer: 'Groceries rose four months running.' });

    const [url, request] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('openai.com');
    const body = JSON.parse(request.body as string);
    expect(body.model).toBe('test-model');
    expect(body.messages[0]).toEqual({ role: 'system', content: spendingInsightQaSystemPrompt });
    expect(body.messages[1]).toEqual({ role: 'user', content: JSON.stringify(input) });
    expect(body.response_format.json_schema.strict).toBe(true);
  });

  it('throws when the response is not ok', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const provider = createOpenAiSpendingInsightAnswerProvider({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl
    });

    await expect(
      provider({
        question: 'how is spending?',
        insight: {
          monthKey: '2026-06',
          headline: 'h',
          observations: ['a', 'b'],
          prediction: 'p'
        },
        months: []
      })
    ).rejects.toThrow(/500/);
  });
});
