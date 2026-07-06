import { describe, expect, it, vi } from 'vitest';

import type { SpendingInsightAiInput } from './assembly';
import { runSpendingInsightSweep, type SpendingInsightSweepSource, storeSpendingInsightHandler } from './generation';

const sweepSource: SpendingInsightSweepSource = {
  targetMonthKey: '2026-06',
  breakdownRows: [{ monthKey: '2026-06', category: 'Groceries', amount: 120_050 }],
  budgetRows: []
};

const validOutput = {
  headline: 'Grocery creep is quietly offsetting the transport savings.',
  observations: [
    'Groceries have risen for four consecutive months while transport fell.',
    'Subscriptions spike every third month in a billing cycle pattern.'
  ],
  prediction: 'Card spend should land slightly above the trailing average next month.'
};

describe('runSpendingInsightSweep', () => {
  it('is idle when no month needs an insight', async () => {
    const storeInsight = vi.fn();
    await expect(
      runSpendingInsightSweep({
        sweepSource: null,
        provider: { generate: async () => validOutput, model: 'test-model' },
        storeInsight,
        generatedAt: 1_700_000_000_000
      })
    ).resolves.toEqual({ status: 'idle' });
    expect(storeInsight).not.toHaveBeenCalled();
  });

  it('skips cleanly when no provider is configured', async () => {
    const storeInsight = vi.fn();
    await expect(
      runSpendingInsightSweep({
        sweepSource,
        provider: null,
        storeInsight,
        generatedAt: 1_700_000_000_000
      })
    ).resolves.toEqual({ status: 'skipped', reason: 'setup_problem' });
    expect(storeInsight).not.toHaveBeenCalled();
  });

  it('records a provider failure without storing anything', async () => {
    const storeInsight = vi.fn();
    await expect(
      runSpendingInsightSweep({
        sweepSource,
        provider: {
          generate: async () => {
            throw new Error('boom');
          },
          model: 'test-model'
        },
        storeInsight,
        generatedAt: 1_700_000_000_000
      })
    ).resolves.toEqual({ status: 'failed', monthKey: '2026-06', reason: 'provider_failure' });
    expect(storeInsight).not.toHaveBeenCalled();
  });

  it('records invalid AI output without storing anything', async () => {
    const storeInsight = vi.fn();
    await expect(
      runSpendingInsightSweep({
        sweepSource,
        provider: { generate: async () => ({ headline: '' }), model: 'test-model' },
        storeInsight,
        generatedAt: 1_700_000_000_000
      })
    ).resolves.toEqual({ status: 'failed', monthKey: '2026-06', reason: 'invalid_ai_output' });
    expect(storeInsight).not.toHaveBeenCalled();
  });

  it('assembles the AI input for the target month and stores the parsed insight', async () => {
    const generate = vi.fn(async (input: SpendingInsightAiInput) => {
      expect(input.targetMonthKey).toBe('2026-06');
      expect(input.months).toHaveLength(1);
      return validOutput;
    });
    const storeInsight = vi.fn(async () => ({ inserted: true as const }));

    await expect(
      runSpendingInsightSweep({
        sweepSource,
        provider: { generate, model: 'test-model' },
        storeInsight,
        generatedAt: 1_700_000_000_000
      })
    ).resolves.toEqual({ status: 'generated', monthKey: '2026-06', inserted: true });

    expect(storeInsight).toHaveBeenCalledWith({
      monthKey: '2026-06',
      headline: validOutput.headline,
      observations: validOutput.observations,
      prediction: validOutput.prediction,
      generatedAt: 1_700_000_000_000,
      model: 'test-model'
    });
  });
});

describe('storeSpendingInsightHandler', () => {
  function fakeDb(existing: Array<{ _id: string; monthKey: string }>) {
    const inserted: Array<Record<string, unknown>> = [];
    return {
      inserted,
      db: {
        query: () => ({
          withIndex: (_index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
            let monthKey = '';
            apply({
              eq: (_field, value) => {
                monthKey = value;
                return {};
              }
            });
            return {
              unique: async () => existing.find((row) => row.monthKey === monthKey) ?? null
            };
          }
        }),
        insert: async (_table: string, row: Record<string, unknown>) => {
          inserted.push(row);
          return 'new-id';
        }
      }
    };
  }

  const row = {
    monthKey: '2026-06',
    headline: 'h',
    observations: ['one', 'two'],
    prediction: 'p',
    generatedAt: 1_700_000_000_000,
    model: 'test-model'
  };

  it('inserts when no insight exists for the month', async () => {
    const { db, inserted } = fakeDb([]);
    await expect(storeSpendingInsightHandler({ db }, row)).resolves.toEqual({ inserted: true, id: 'new-id' });
    expect(inserted).toEqual([row]);
  });

  it('never inserts a second insight for the same month', async () => {
    const { db, inserted } = fakeDb([{ _id: 'existing-id', monthKey: '2026-06' }]);
    await expect(storeSpendingInsightHandler({ db }, row)).resolves.toEqual({ inserted: false, id: 'existing-id' });
    expect(inserted).toEqual([]);
  });
});
