import { describe, expect, it } from 'vitest';
import {
  shapeMonthDetail,
  type BudgetRow,
  type MortgageRow
} from './monthDetail';

const MS = 86_400_000;

const budgetRow: BudgetRow = {
  _id: 'b' as any,
  _creationTime: 0,
  date: MS * 100,
  incomePrimary: 800_000,
  incomeSecondary: 50_000,
  billContrib: 20_000,
  credit1: 90_000,
  credit2: 60_000,
  credit3: 80_000,
  oneOffs: 34_000,
  shared: 0,
  variable: 0,
  fixed: 0,
  rent: 0
};

const mortgageRow: MortgageRow = {
  _id: 'm' as any,
  _creationTime: 0,
  date: MS * 100,
  deposit: 0,
  familyContrib: 0,
  debt1: 30_000_000,
  debt2: 10_000_000,
  interestCharged: 120_000,
  principalPaid: 80_000,
  contrib1: 100_000,
  contrib2: 120_000,
  contrib3: 72_000,
  price: 80_000_000,
  landValue: 0,
  capitalGrowth: 0
};

describe('shapeMonthDetail', () => {
  it('returns null when budget row missing', () => {
    expect(shapeMonthDetail(null, mortgageRow)).toBeNull();
  });

  it('returns income subtotal', () => {
    const r = shapeMonthDetail(budgetRow, null)!;
    expect(r.income.total).toBe(870_000); // 800k+50k+20k
  });

  it('returns spend subtotal (credit + oneOffs)', () => {
    const r = shapeMonthDetail(budgetRow, null)!;
    expect(r.spend.total).toBe(264_000); // 90+60+80+34 (thousands of cents)
  });

  it('returns null mortgage when no mortgage row', () => {
    expect(shapeMonthDetail(budgetRow, null)!.mortgage).toBeNull();
  });

  it('returns mortgage block with derived totals', () => {
    const r = shapeMonthDetail(budgetRow, mortgageRow)!;
    expect(r.mortgage).not.toBeNull();
    expect(r.mortgage!.contribTotal).toBe(292_000); // 100+120+72
    expect(r.mortgage!.totalDebt).toBe(40_000_000);
    expect(r.mortgage!.equity).toBe(40_000_000); // 80M - 40M
  });
});
