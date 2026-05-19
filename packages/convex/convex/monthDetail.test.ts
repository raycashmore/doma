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
  sharedOut: 0,
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
  debt1: 30_000_000,
  debt2: 10_000_000,
  fixedPayment: 240_000,
  variablePayment: 150_000,
  rateVar: 6.12,
  rateFixed: 5.49,
  offset1: 25_000_000,
  offset2: 2_500_000
};

const mortgageConfig = {
  _id: 'cfg' as any,
  _creationTime: 0,
  key: 'default' as const,
  price: 80_000_000,
  deposit: 0,
  familyContrib: 0,
  contrib1: 100_000,
  contrib2: 120_000,
  contrib3: 72_000,
  loanValue: 90_000_000
};

const priorMortgageRow: MortgageRow = {
  ...mortgageRow,
  _id: 'm-prior' as any,
  date: MS * 70,
  fixedPayment: 240_000,
  variablePayment: 150_000
};

describe('shapeMonthDetail', () => {
  it('returns null when budget row missing', () => {
    expect(shapeMonthDetail(null, mortgageRow, mortgageConfig)).toBeNull();
  });

  it('returns income subtotal', () => {
    const r = shapeMonthDetail(budgetRow, null, mortgageConfig)!;
    expect(r.income.total).toBe(870_000); // 800k+50k+20k
  });

  it('returns spend subtotal (credit + oneOffs)', () => {
    const r = shapeMonthDetail(budgetRow, null, mortgageConfig)!;
    expect(r.spend.total).toBe(264_000); // 90+60+80+34 (thousands of cents)
  });

  it('returns null mortgage when no mortgage row', () => {
    expect(
      shapeMonthDetail(budgetRow, null, mortgageConfig)!.mortgage
    ).toBeNull();
  });

  it('returns mortgage block with derived totals', () => {
    const r = shapeMonthDetail(budgetRow, mortgageRow, mortgageConfig)!;
    expect(r.mortgage).not.toBeNull();
    expect(r.mortgage!.contribTotal).toBe(292_000); // 100+120+72
    expect(r.mortgage!.fixedPayment).toBe(240_000);
    expect(r.mortgage!.variablePayment).toBe(150_000);
    expect(r.mortgage!.paymentTotal).toBe(390_000);
    expect(r.mortgage!.totalDebt).toBe(40_000_000);
    expect(r.mortgage!.equity).toBe(40_000_000); // 80M - 40M
    expect(r.mortgage!.offset1).toBe(25_000_000);
    expect(r.mortgage!.offset2).toBe(2_500_000);
  });

  it('returns null trends when no prior data', () => {
    const r = shapeMonthDetail(budgetRow, mortgageRow, mortgageConfig)!;
    expect(r.trends.income).toBeNull();
    expect(r.trends.spend).toBeNull();
    expect(r.trends.mortgage).toBeNull();
  });

  it('returns income trend up when income increases', () => {
    const r = shapeMonthDetail(
      budgetRow,
      mortgageRow,
      mortgageConfig,
      priorBudgetRow,
      null
    )!;
    // current 870k vs prior 770k → +12.987% → rounds to 13.0
    expect(r.trends.income).toEqual({ pct: 13.0, direction: 'up' });
  });

  it('returns spend trend down when spend decreases', () => {
    const r = shapeMonthDetail(
      budgetRow,
      mortgageRow,
      mortgageConfig,
      priorBudgetRow,
      null
    )!;
    // current 264k vs prior 280k → −5.71% → rounds to −5.7
    expect(r.trends.spend).toEqual({ pct: -5.7, direction: 'down' });
  });

  it('returns flat mortgage trend when contrib unchanged', () => {
    const r = shapeMonthDetail(
      budgetRow,
      mortgageRow,
      mortgageConfig,
      priorBudgetRow,
      priorMortgageRow
    )!;
    expect(r.trends.mortgage).toEqual({ pct: 0, direction: 'flat' });
  });

  it('returns null mortgage trend when prior mortgage missing', () => {
    const r = shapeMonthDetail(
      budgetRow,
      mortgageRow,
      mortgageConfig,
      priorBudgetRow,
      null
    )!;
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
