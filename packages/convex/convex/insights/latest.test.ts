import { describe, expect, it } from 'vitest';

import { pickLatestSpendingInsight, type SpendingInsightRow } from './latest';

function insight(monthKey: string, overrides: Partial<SpendingInsightRow> = {}): SpendingInsightRow {
  return {
    monthKey,
    headline: `Headline for ${monthKey}`,
    observations: ['Groceries drifted upward while dining out fell.'],
    prediction: 'Expect card spend to settle near the trailing average.',
    generatedAt: 1_700_000_000_000,
    model: 'test-model',
    ...overrides
  };
}

describe('pickLatestSpendingInsight', () => {
  it('returns null when no insights exist', () => {
    expect(pickLatestSpendingInsight([])).toBeNull();
  });

  it('returns the single insight when only one exists', () => {
    const only = insight('2026-05');
    expect(pickLatestSpendingInsight([only])).toEqual(only);
  });

  it('returns the insight with the greatest month key regardless of input order', () => {
    const rows = [insight('2026-01'), insight('2026-06'), insight('2025-12'), insight('2026-03')];
    expect(pickLatestSpendingInsight(rows)?.monthKey).toBe('2026-06');
  });

  it('compares month keys across year boundaries', () => {
    const rows = [insight('2025-12'), insight('2026-01')];
    expect(pickLatestSpendingInsight(rows)?.monthKey).toBe('2026-01');
  });
});
