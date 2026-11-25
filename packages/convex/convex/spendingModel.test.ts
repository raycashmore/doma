import { describe, expect, it } from 'vitest';

import type { Doc, Id } from './_generated/dataModel';
import { buildSpendingMonths, isMonthKey, monthSpan, shiftMonth, spendingMonth, summarizeRange } from './spendingModel';

/** Month-end in UTC, as the seed writes budget dates. */
const monthEnd = (year: number, month: number) => Date.UTC(year, month, 0);

function budget(
  date: number,
  values: Partial<Pick<Doc<'budget'>, 'incomePrimary' | 'billContrib' | 'credit1' | 'oneOffs' | 'sharedOut'>> = {}
): Doc<'budget'> {
  return {
    _id: 'b' as Id<'budget'>,
    _creationTime: 0,
    date,
    incomePrimary: values.incomePrimary ?? 1_000_00,
    incomeSecondary: 0,
    billContrib: values.billContrib ?? 0,
    credit1: values.credit1 ?? 400_00,
    credit2: 0,
    credit3: 0,
    oneOffs: values.oneOffs ?? 0,
    sharedOut: values.sharedOut ?? 0,
    rent: 0
  };
}

function mortgage(date: number, fixedPayment: number): Doc<'mortgage'> {
  return {
    _id: 'm' as Id<'mortgage'>,
    _creationTime: 0,
    date,
    debt1: 0,
    debt2: 0,
    fixedPayment,
    variablePayment: 0,
    rateVar: 6.1,
    rateFixed: 5.9,
    offset1: 0,
    offset2: 0
  };
}

describe('month keys', () => {
  it('validates YYYY-MM', () => {
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-1')).toBe(false);
  });

  it('shifts across year boundaries and counts inclusive spans', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-11', 3)).toBe('2026-02');
    expect(monthSpan('2026-08', '2026-10')).toBe(3);
    expect(monthSpan('2025-07', '2026-06')).toBe(12);
  });
});

describe('spendingMonth', () => {
  it('counts everything that leaves as spend, and leaves the mortgage rates out of income', () => {
    const month = spendingMonth(
      budget(monthEnd(2026, 10), {
        incomePrimary: 9_000_00,
        billContrib: 400_00,
        credit1: 3_000_00,
        oneOffs: 500_00,
        sharedOut: 900_00
      }),
      mortgage(monthEnd(2026, 10), 3_000_00)
    );
    expect(month).toMatchObject({
      monthKey: '2026-10',
      income: 9_400_00,
      dayToDay: 3_500_00,
      shared: 900_00,
      mortgage: 3_000_00,
      spend: 7_400_00,
      net: 2_000_00
    });
  });
});

describe('buildSpendingMonths', () => {
  it('orders months oldest first and averages over up to six trailing months across all history', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((m) => budget(monthEnd(2026, m), { incomePrimary: m * 100_00, credit1: 0 }));
    const months = buildSpendingMonths(rows.reverse(), []);

    expect(months.map((m) => m.monthKey)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07'
    ]);
    expect(months[0]!.incomeAverage).toBe(100_00);
    expect(months[1]!.incomeAverage).toBe(150_00);
    // July averages February to July.
    expect(months[6]!.incomeAverage).toBe(450_00);
  });

  it("uses only the month's own mortgage row", () => {
    const months = buildSpendingMonths(
      [budget(monthEnd(2026, 9)), budget(monthEnd(2026, 10))],
      [mortgage(monthEnd(2026, 9), 2_000_00)]
    );
    expect(months.map((m) => m.mortgage)).toEqual([2_000_00, 0]);
  });
});

describe('summarizeRange', () => {
  // Nine months, Feb to Oct 2026; net grows by $100 a month.
  const months = buildSpendingMonths(
    [2, 3, 4, 5, 6, 7, 8, 9, 10].map((m) =>
      budget(monthEnd(2026, m), { incomePrimary: 1_000_00 + m * 100_00, credit1: 400_00 })
    ),
    []
  );

  it('includes exactly the months in an inclusive range (RAY-57)', () => {
    const summary = summarizeRange(months, { from: '2026-08', to: '2026-10' });
    expect(summary.monthCount).toBe(3);
    expect(summary.avgIncome.value).toBe(1_900_00);
  });

  it('compares with the range of the same length just before', () => {
    const summary = summarizeRange(months, { from: '2026-08', to: '2026-10' });
    expect(summary.comparison).toEqual({ from: '2026-05', to: '2026-07', monthCount: 3 });
    expect(summary.avgNet).toEqual({ value: 1_500_00, delta: 300_00, deltaPct: 25 });
  });

  it('compares with only the months that exist before the range', () => {
    const summary = summarizeRange(months, { from: '2026-05', to: '2026-10' });
    expect(summary.comparison).toEqual({ from: '2025-11', to: '2026-04', monthCount: 3 });
  });

  it('has no comparison when nothing comes before the range', () => {
    const summary = summarizeRange(months, { from: '2026-02', to: '2026-10' });
    expect(summary.comparison).toBeNull();
    expect(summary.avgSpend.delta).toBeNull();
  });

  it('reports the savings rate in basis points', () => {
    const summary = summarizeRange(months, { from: '2026-10', to: '2026-10' });
    // Income $2,000, spend $400: 80%.
    expect(summary.savingsRate.value).toBe(8_000);
  });

  it('never sends -0, which Convex encodes as a float the apps cannot read as a whole number', () => {
    // Nets of -1, +1 and -1 cents: the average and the savings rate both round to -0.
    const nearZero = buildSpendingMonths(
      [1, 2, 3].map((m) =>
        budget(monthEnd(2026, m), { incomePrimary: 1_000_00, credit1: m === 2 ? 999_99 : 1_000_01 })
      ),
      []
    );
    const summary = summarizeRange(nearZero, { from: '2026-01', to: '2026-03' });
    expect(Object.is(summary.avgNet.value, 0)).toBe(true);
    expect(Object.is(summary.savingsRate.value, 0)).toBe(true);
  });

  it('returns zeros for a range with no months', () => {
    const summary = summarizeRange(months, { from: '2030-01', to: '2030-06' });
    expect(summary.monthCount).toBe(0);
    expect(summary.avgIncome.value).toBe(0);
    expect(summary.savingsRate.value).toBe(0);
  });
});
