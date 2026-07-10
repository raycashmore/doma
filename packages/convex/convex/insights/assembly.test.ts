import { describe, expect, it } from 'vitest';

import {
  buildSpendingInsightAiInput,
  latestMonthKeyNeedingInsight,
  type SpendingInsightBreakdownRow,
  type SpendingInsightBudgetRow
} from './assembly';

function breakdownRow(monthKey: string, category: string, amountCents: number): SpendingInsightBreakdownRow {
  return { monthKey, category, amount: amountCents };
}

function budgetRow(dateIso: string, overrides: Partial<SpendingInsightBudgetRow> = {}): SpendingInsightBudgetRow {
  return {
    date: Date.parse(dateIso),
    incomePrimary: 0,
    incomeSecondary: 0,
    billContrib: 0,
    credit1: 0,
    credit2: 0,
    credit3: 0,
    oneOffs: 0,
    ...overrides
  };
}

describe('latestMonthKeyNeedingInsight', () => {
  it('returns the latest month with breakdown and budget data when no insight is stored for it', () => {
    expect(
      latestMonthKeyNeedingInsight({
        breakdownMonthKeys: ['2026-04', '2026-05', '2026-06'],
        budgetMonthKeys: ['2026-04', '2026-05', '2026-06'],
        insightMonthKeys: ['2026-04', '2026-05']
      })
    ).toBe('2026-06');
  });

  it('returns null when every eligible month already has an insight', () => {
    expect(
      latestMonthKeyNeedingInsight({
        breakdownMonthKeys: ['2026-05', '2026-06'],
        budgetMonthKeys: ['2026-05', '2026-06'],
        insightMonthKeys: ['2026-05', '2026-06']
      })
    ).toBeNull();
  });

  it('returns null when there is no breakdown data at all', () => {
    expect(
      latestMonthKeyNeedingInsight({ breakdownMonthKeys: [], budgetMonthKeys: ['2026-06'], insightMonthKeys: [] })
    ).toBeNull();
  });

  it('waits for the budget row: a breakdown-only month is not eligible', () => {
    expect(
      latestMonthKeyNeedingInsight({
        breakdownMonthKeys: ['2026-05', '2026-06'],
        budgetMonthKeys: ['2026-05'],
        insightMonthKeys: []
      })
    ).toBe('2026-05');
  });

  it('returns null when no month has both breakdown and budget data', () => {
    expect(
      latestMonthKeyNeedingInsight({
        breakdownMonthKeys: ['2026-06'],
        budgetMonthKeys: ['2026-05'],
        insightMonthKeys: []
      })
    ).toBeNull();
  });

  it('regenerates a deleted older insight even when newer months have insights', () => {
    expect(
      latestMonthKeyNeedingInsight({
        breakdownMonthKeys: ['2026-04', '2026-05', '2026-06'],
        budgetMonthKeys: ['2026-04', '2026-05', '2026-06'],
        insightMonthKeys: ['2026-04', '2026-06']
      })
    ).toBe('2026-05');
  });

  it('compares month keys across year boundaries', () => {
    expect(
      latestMonthKeyNeedingInsight({
        breakdownMonthKeys: ['2025-12', '2026-01'],
        budgetMonthKeys: ['2025-12', '2026-01'],
        insightMonthKeys: []
      })
    ).toBe('2026-01');
  });
});

describe('buildSpendingInsightAiInput', () => {
  it('assembles categories and budget totals for the target month in major units with a label', () => {
    const input = buildSpendingInsightAiInput({
      targetMonthKey: '2026-06',
      breakdownRows: [breakdownRow('2026-06', 'Groceries', 120_050), breakdownRow('2026-06', 'Transport', 30_000)],
      budgetRows: [
        budgetRow('2026-06-15T00:00:00.000Z', {
          incomePrimary: 800_000,
          incomeSecondary: 400_000,
          billContrib: 50_000,
          credit1: 100_000,
          credit2: 60_000,
          credit3: 40_000,
          oneOffs: 25_000
        })
      ]
    });

    expect(input.targetMonthKey).toBe('2026-06');
    expect(input.months).toEqual([
      {
        monthKey: '2026-06',
        monthLabel: 'June 2026',
        categories: [
          { category: 'Groceries', amount: 1200.5 },
          { category: 'Transport', amount: 300 }
        ],
        budgetTotals: {
          income: 12500,
          oneOffs: 250,
          cardSpend: 2000
        }
      }
    ]);
  });

  it('includes the target month and the same month last year, oldest first', () => {
    const monthKeys = [
      '2025-04',
      '2025-05',
      '2025-06',
      '2025-07',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07'
    ];
    const input = buildSpendingInsightAiInput({
      targetMonthKey: '2026-06',
      breakdownRows: monthKeys.map((monthKey) => breakdownRow(monthKey, 'Groceries', 10_000)),
      budgetRows: []
    });

    expect(input.months.map((month) => month.monthKey)).toEqual([
      '2025-06',
      '2025-07',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06'
    ]);
  });

  it('provides rounded month-on-month and year-on-year percentages for the target month', () => {
    const input = buildSpendingInsightAiInput({
      targetMonthKey: '2026-05',
      breakdownRows: [
        breakdownRow('2025-05', 'Groceries', 10_000),
        breakdownRow('2025-05', 'Shopping', 20_000),
        breakdownRow('2026-04', 'Groceries', 10_000),
        breakdownRow('2026-04', 'Shopping', 50_000),
        breakdownRow('2026-05', 'Groceries', 12_000),
        breakdownRow('2026-05', 'Shopping', 53_000)
      ],
      budgetRows: []
    });

    expect(input.comparisonSummary).toEqual({
      fromPreviousMonth: {
        monthLabel: 'April 2026',
        totalSpendPercentageChange: 8,
        categoryPercentageChanges: [
          { category: 'Groceries', percentageChange: 20 },
          { category: 'Shopping', percentageChange: 6 }
        ]
      },
      fromSameMonthLastYear: {
        monthLabel: 'May 2025',
        totalSpendPercentageChange: 117
      }
    });
  });

  it('omits budget totals for months without a budget row', () => {
    const input = buildSpendingInsightAiInput({
      targetMonthKey: '2026-06',
      breakdownRows: [breakdownRow('2026-06', 'Groceries', 10_000)],
      budgetRows: [budgetRow('2026-03-15T00:00:00.000Z', { incomePrimary: 800_000 })]
    });

    expect(input.months).toEqual([
      {
        monthKey: '2026-06',
        monthLabel: 'June 2026',
        categories: [{ category: 'Groceries', amount: 100 }]
      }
    ]);
  });
});
