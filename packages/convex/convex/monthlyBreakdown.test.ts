import { describe, expect, it } from 'vitest';
import {
  joinBudgetWithMortgage,
  type BudgetRow,
  type MortgageRow
} from './monthlyBreakdown';

const MS = 86_400_000;

function b(date: number, inP: number, credit: number): BudgetRow {
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
    variable: 0,
    fixed: 0,
    rent: 0
  };
}

function m(date: number, c1: number, c2: number, c3: number): MortgageRow {
  return {
    _id: 'x' as any,
    _creationTime: 0,
    date,
    deposit: 0,
    familyContrib: 0,
    debt1: 0,
    debt2: 0,
    interestCharged: 0,
    principalPaid: 0,
    contrib1: c1,
    contrib2: c2,
    contrib3: c3,
    price: 0,
    landValue: 0,
    capitalGrowth: 0
  };
}

describe('joinBudgetWithMortgage', () => {
  it('returns null mortgage when no mortgage rows exist', () => {
    const out = joinBudgetWithMortgage([b(MS, 100, 30)], []);
    expect(out).toEqual([
      { date: MS, income: 100, spend: 30, mortgage: null, net: 70 }
    ]);
  });

  it('matches exact-date mortgage row', () => {
    const out = joinBudgetWithMortgage(
      [b(MS * 10, 100, 30)],
      [m(MS * 10, 10, 20, 30)]
    );
    expect(out[0]!.mortgage).toBe(60);
  });

  it('carries forward most recent prior mortgage', () => {
    const out = joinBudgetWithMortgage(
      [b(MS * 20, 100, 30), b(MS * 30, 200, 40)],
      [m(MS * 15, 10, 20, 30)]
    );
    expect(out[0]!.mortgage).toBe(60); // carried forward to budget at MS*20
    expect(out[1]!.mortgage).toBe(60); // still carried forward to MS*30
  });

  it('returns null mortgage when budget row precedes earliest mortgage row', () => {
    const out = joinBudgetWithMortgage(
      [b(MS * 5, 100, 30)],
      [m(MS * 10, 10, 20, 30)]
    );
    expect(out[0]!.mortgage).toBeNull();
  });

  it('returns rows in descending date order', () => {
    const out = joinBudgetWithMortgage(
      [b(MS * 10, 1, 0), b(MS * 30, 3, 0), b(MS * 20, 2, 0)],
      []
    );
    expect(out.map((r) => r.date)).toEqual([MS * 30, MS * 20, MS * 10]);
  });

  it('respects limit (taking most recent)', () => {
    const out = joinBudgetWithMortgage(
      [b(MS * 10, 1, 0), b(MS * 20, 2, 0), b(MS * 30, 3, 0)],
      [],
      2
    );
    expect(out.map((r) => r.date)).toEqual([MS * 30, MS * 20]);
  });
});
