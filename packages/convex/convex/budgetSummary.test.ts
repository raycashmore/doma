import { describe, expect, it } from 'vitest';
import {
  summarizeBudgetForPeriod,
  type SummaryPeriod,
  type BudgetRow
} from './budgetSummary';

function row(
  date: number,
  incomePrimary: number,
  incomeSecondary: number,
  billContrib: number,
  credit1: number,
  credit2: number,
  credit3: number,
  oneOffs: number,
  sharedOut: number
): BudgetRow {
  return {
    _id: 'x' as any,
    _creationTime: 0,
    date,
    incomePrimary,
    incomeSecondary,
    billContrib,
    credit1,
    credit2,
    credit3,
    oneOffs,
    sharedOut,
    rent: 0
  };
}

const MS = 86_400_000;
const month = (i: number) => i * 30 * MS; // synthetic month spacing

describe('summarizeBudgetForPeriod', () => {
  it('returns zeros + null deltas for empty data', () => {
    const r = summarizeBudgetForPeriod([], [], '12M', 999_999_999_999);
    expect(r.avgSpend.value).toBe(0);
    expect(r.avgSpend.delta).toBeNull();
    expect(r.avgIncome.value).toBe(0);
    expect(r.savingsRate.value).toBe(0);
    expect(r.netGain.value).toBe(0);
  });

  it('ALL period uses every row, prior window empty', () => {
    const rows = [
      row(month(1), 100_000, 0, 0, 30_000, 0, 0, 0, 0),
      row(month(2), 200_000, 0, 0, 40_000, 0, 0, 0, 0)
    ];
    const r = summarizeBudgetForPeriod(rows, [], 'ALL', month(2));
    expect(r.avgIncome.value).toBe(150_000); // (100000 + 200000) / 2
    expect(r.avgSpend.value).toBe(35_000); // (30000 + 40000) / 2
    expect(r.netGain.value).toBe(115_000); // 150000 - 35000
    expect(r.avgIncome.delta).toBeNull();
  });

  it('savings rate is in basis points', () => {
    const rows = [row(month(1), 100_000, 0, 0, 88_000, 0, 0, 0, 0)];
    const r = summarizeBudgetForPeriod(rows, [], 'ALL', month(1));
    // net = 12000, in = 100000 -> 12% -> 1200 bp
    expect(r.savingsRate.value).toBe(1200);
  });

  it('12M window picks last 12 months and prior 12 for delta', () => {
    const rows: BudgetRow[] = [];
    // 24 months of synthetic data, income doubling in second 12
    for (let i = 0; i < 24; i++) {
      rows.push(
        row(month(i + 1), i < 12 ? 100_000 : 200_000, 0, 0, 0, 0, 0, 0, 0)
      );
    }
    const r = summarizeBudgetForPeriod(rows, [], '12M', month(24));
    expect(r.avgIncome.value).toBe(200_000);
    expect(r.avgIncome.delta).toBe(100_000); // 200000 - 100000
    expect(r.avgIncome.deltaPct).toBeCloseTo(100, 1); // +100%
  });

  it('periodLabel reflects window choice', () => {
    expect(summarizeBudgetForPeriod([], [], '12M', 0).periodLabel).toBe('12 mo');
    expect(summarizeBudgetForPeriod([], [], '6M', 0).periodLabel).toBe('6 mo');
    expect(summarizeBudgetForPeriod([], [], '3M', 0).periodLabel).toBe('3 mo');
    expect(summarizeBudgetForPeriod([], [], 'ALL', 0).periodLabel).toBe('All time');
  });
});
