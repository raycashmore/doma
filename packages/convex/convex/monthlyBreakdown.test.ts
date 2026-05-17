import { describe, expect, it } from 'vitest';
import { buildMonthlyBreakdown, type BudgetRow } from './monthlyBreakdown';

const MS = 86_400_000;

function b(
  date: number,
  inP: number,
  credit: number,
  variable = 0,
  fixed = 0
): BudgetRow {
  return {
    _id: 'x' as any,
    _creationTime: 0,
    date,
    incomePrimary: inP,
    incomeSecondary: 0,
    billContrib: 0,
    credit1: credit,
    credit2: 0,
    credit3: 0,
    oneOffs: 0,
    shared: 0,
    variable,
    fixed,
    rent: 0
  };
}

describe('buildMonthlyBreakdown', () => {
  it('derives mortgage from |variable| + |fixed| (expenses stored as negatives)', () => {
    const out = buildMonthlyBreakdown([b(MS, 100, 30, -1500, -2400)]);
    expect(out).toEqual([
      { date: MS, income: 100, spend: 30, mortgage: 3900, net: 70 }
    ]);
  });

  it('also handles positive variable / fixed values', () => {
    const out = buildMonthlyBreakdown([b(MS, 100, 30, 500, 1000)]);
    expect(out[0]!.mortgage).toBe(1500);
  });

  it('returns zero mortgage when variable and fixed are zero', () => {
    const out = buildMonthlyBreakdown([b(MS, 100, 30)]);
    expect(out[0]!.mortgage).toBe(0);
  });

  it('returns rows in descending date order', () => {
    const out = buildMonthlyBreakdown([
      b(MS * 10, 1, 0),
      b(MS * 30, 3, 0),
      b(MS * 20, 2, 0)
    ]);
    expect(out.map((r) => r.date)).toEqual([MS * 30, MS * 20, MS * 10]);
  });

  it('respects limit (taking most recent)', () => {
    const out = buildMonthlyBreakdown(
      [b(MS * 10, 1, 0), b(MS * 20, 2, 0), b(MS * 30, 3, 0)],
      2
    );
    expect(out.map((r) => r.date)).toEqual([MS * 30, MS * 20]);
  });
});
