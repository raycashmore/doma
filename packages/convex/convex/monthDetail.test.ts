import { describe, expect, it } from 'vitest';
import {
  computeTrend,
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

const priorBudgetRow: BudgetRow = {
  ...budgetRow,
  _id: 'b-prior' as any,
  date: MS * 70,
  incomePrimary: 700_000,
  incomeSecondary: 50_000,
  billContrib: 20_000, // prior income total = 770_000 → +12.987% ≈ 13.0
  credit1: 100_000,
  credit2: 60_000,
  credit3: 80_000,
  oneOffs: 40_000 // prior spend total = 280_000 → −5.71% ≈ −5.7
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

const priorMortgageRow: MortgageRow = {
  ...mortgageRow,
  _id: 'm-prior' as any,
  date: MS * 70,
  contrib1: 100_000,
  contrib2: 120_000,
  contrib3: 72_000 // identical contrib → flat
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

  it('returns null trends when no prior data', () => {
    const r = shapeMonthDetail(budgetRow, mortgageRow)!;
    expect(r.trends.income).toBeNull();
    expect(r.trends.spend).toBeNull();
    expect(r.trends.mortgage).toBeNull();
  });

  it('returns income trend up when income increases', () => {
    const r = shapeMonthDetail(budgetRow, mortgageRow, priorBudgetRow, null)!;
    // current 870k vs prior 770k → +12.987% → rounds to 13.0
    expect(r.trends.income).toEqual({ pct: 13.0, direction: 'up' });
  });

  it('returns spend trend down when spend decreases', () => {
    const r = shapeMonthDetail(budgetRow, mortgageRow, priorBudgetRow, null)!;
    // current 264k vs prior 280k → −5.71% → rounds to −5.7
    expect(r.trends.spend).toEqual({ pct: -5.7, direction: 'down' });
  });

  it('returns flat mortgage trend when contrib unchanged', () => {
    const r = shapeMonthDetail(
      budgetRow,
      mortgageRow,
      priorBudgetRow,
      priorMortgageRow
    )!;
    expect(r.trends.mortgage).toEqual({ pct: 0, direction: 'flat' });
  });

  it('returns null mortgage trend when prior mortgage missing', () => {
    const r = shapeMonthDetail(budgetRow, mortgageRow, priorBudgetRow, null)!;
    expect(r.trends.mortgage).toBeNull();
  });
});

describe('computeTrend', () => {
  it('returns null when prior is null', () => {
    expect(computeTrend(100, null)).toBeNull();
  });

  it('returns null when prior is zero (avoid div by zero)', () => {
    expect(computeTrend(100, 0)).toBeNull();
  });

  it('rounds percentage to 1 decimal', () => {
    expect(computeTrend(105, 100)).toEqual({ pct: 5, direction: 'up' });
    expect(computeTrend(102.345, 100)).toEqual({ pct: 2.3, direction: 'up' });
  });

  it('treats rounded-zero change as flat', () => {
    // 0.04% rounds to 0.0 → flat
    expect(computeTrend(100.04, 100)).toEqual({ pct: 0, direction: 'flat' });
  });
});
