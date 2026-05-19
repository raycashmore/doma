import { describe, expect, it } from 'vitest';
import {
  buildMortgageByMonth,
  buildMonthlyBreakdown,
  utcYearMonthKey,
  type BudgetRow,
  type MortgageRow
} from './monthlyBreakdown';

const MS = 86_400_000;

function b(date: number, inP: number, credit: number): BudgetRow {
  return {
    _id: 'b' as any,
    _creationTime: 0,
    date,
    incomePrimary: inP,
    incomeSecondary: 0,
    billContrib: 0,
    credit1: credit,
    credit2: 0,
    credit3: 0,
    oneOffs: 0,
    sharedOut: 0,
    rent: 0
  } as any;
}

function m(
  date: number,
  variablePayment = 0,
  fixedPayment = 0,
  creationTime = 0
): MortgageRow {
  return {
    _id: 'm' as any,
    _creationTime: creationTime,
    date,
    debt1: 0,
    debt2: 0,
    variablePayment,
    fixedPayment,
    rateVar: undefined,
    rateFixed: undefined,
    offset1: 0,
    offset2: 0
  } as any;
}

describe('buildMonthlyBreakdown', () => {
  it('derives mortgage from mortgage.variablePayment + mortgage.fixedPayment', () => {
    const out = buildMonthlyBreakdown([b(MS, 100, 30)], [m(MS, 1500, 2400)]);
    expect(out).toEqual([
      { date: MS, income: 100, spend: 30, mortgage: 3900, net: -3830 }
    ]);
  });

  it('returns zero mortgage when no matching mortgage row exists', () => {
    const out = buildMonthlyBreakdown([b(MS, 100, 30)], []);
    expect(out[0]!.mortgage).toBe(0);
  });

  it('joins mortgage by UTC year-month when dates differ within the month', () => {
    const budgetDate = Date.UTC(2025, 0, 31);
    const mortgageDate = Date.UTC(2025, 0, 1);

    const out = buildMonthlyBreakdown(
      [b(budgetDate, 100, 30)],
      [m(mortgageDate, 1500, 2400)]
    );

    expect(out[0]!.mortgage).toBe(3900);
  });

  it('keeps the latest mortgage row in a UTC month', () => {
    const monthKey = utcYearMonthKey(Date.UTC(2025, 0, 1));
    const sameMonthEarlierDate = m(Date.UTC(2025, 0, 1), 100, 0, 1);
    const sameMonthLaterDate = m(Date.UTC(2025, 0, 31), 200, 0, 1);
    const sameDateEarlierCreation = m(Date.UTC(2025, 0, 31), 300, 0, 1);
    const sameDateLaterCreation = m(Date.UTC(2025, 0, 31), 400, 0, 2);

    const mortgageByMonth = buildMortgageByMonth([
      sameMonthEarlierDate,
      sameMonthLaterDate,
      sameDateEarlierCreation,
      sameDateLaterCreation
    ]);

    expect(mortgageByMonth.get(monthKey)).toBe(sameDateLaterCreation);
  });

  it('returns rows in descending date order', () => {
    const out = buildMonthlyBreakdown(
      [b(MS * 10, 1, 0), b(MS * 30, 3, 0), b(MS * 20, 2, 0)],
      [m(MS * 10), m(MS * 30), m(MS * 20)]
    );
    expect(out.map((r) => r.date)).toEqual([MS * 30, MS * 20, MS * 10]);
  });

  it('respects limit by taking most recent rows', () => {
    const out = buildMonthlyBreakdown(
      [b(MS * 10, 1, 0), b(MS * 20, 2, 0), b(MS * 30, 3, 0)],
      [m(MS * 10), m(MS * 20), m(MS * 30)],
      2
    );
    expect(out.map((r) => r.date)).toEqual([MS * 30, MS * 20]);
  });
});
