import { describe, expect, it } from 'vitest';

import type { Id } from './_generated/dataModel';
import { type BudgetRow, summarizeBudgetForPeriod } from './budgetSummary';

const id = (value: string) => value as Id<'budget'>;

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
    _id: id('x'),
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

  it('ALL period uses every row and compares the latest month with the prior month', () => {
    const rows = [row(month(1), 100_000, 0, 0, 30_000, 0, 0, 0, 0), row(month(2), 200_000, 0, 0, 40_000, 0, 0, 0, 0)];
    const r = summarizeBudgetForPeriod(rows, [], 'ALL', month(2));
    expect(r.avgIncome.value).toBe(150_000); // (100000 + 200000) / 2
    expect(r.avgSpend.value).toBe(35_000); // (30000 + 40000) / 2
    expect(r.netGain.value).toBe(115_000); // 150000 - 35000
    expect(r.avgIncome.delta).toBe(100_000);
    expect(r.avgIncome.deltaPct).toBe(100);
  });

  it('savings rate is in basis points', () => {
    const rows = [row(month(1), 100_000, 0, 0, 88_000, 0, 0, 0, 0)];
    const r = summarizeBudgetForPeriod(rows, [], 'ALL', month(1));
    // net = 12000, in = 100000 -> 12% -> 1200 bp
    expect(r.savingsRate.value).toBe(1200);
  });

  it('12M value uses the selected window while its delta compares the latest two months', () => {
    const rows: BudgetRow[] = [];
    for (let i = 0; i < 24; i++) {
      const income = i === 23 ? 300_000 : i === 22 ? 200_000 : 100_000;
      rows.push(row(month(i + 1), income, 0, 0, 0, 0, 0, 0, 0));
    }
    const r = summarizeBudgetForPeriod(rows, [], '12M', month(24));
    expect(r.avgIncome.value).toBe(125_000);
    expect(r.avgIncome.delta).toBe(100_000);
    expect(r.avgIncome.deltaPct).toBeCloseTo(50, 1);
  });

  it('periodLabel reflects window choice', () => {
    expect(summarizeBudgetForPeriod([], [], '12M', 0).periodLabel).toBe('12 mo');
    expect(summarizeBudgetForPeriod([], [], '6M', 0).periodLabel).toBe('6 mo');
    expect(summarizeBudgetForPeriod([], [], '3M', 0).periodLabel).toBe('3 mo');
    expect(summarizeBudgetForPeriod([], [], 'ALL', 0).periodLabel).toBe('All time');
  });
});
