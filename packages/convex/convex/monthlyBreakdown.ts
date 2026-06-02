import type { Doc } from './_generated/dataModel';
import { budgetMortgagePortion, budgetTotalIn, budgetTotalOut } from './helpers';

export type BudgetRow = Doc<'budget'>;
export type MortgageRow = Doc<'mortgage'>;

export type BreakdownRow = {
  date: number;
  income: number;
  spend: number;
  mortgage: number;
  net: number;
};

export function utcYearMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

export function buildMortgageByMonth(mortgageRows: MortgageRow[]): Map<string, MortgageRow> {
  const mortgageByMonth = new Map<string, MortgageRow>();

  for (const row of mortgageRows) {
    const key = utcYearMonthKey(row.date);
    const existing = mortgageByMonth.get(key);
    // Prefer the latest row in the month; creation time breaks same-date ties.
    if (
      !existing ||
      row.date > existing.date ||
      (row.date === existing.date && row._creationTime > existing._creationTime)
    ) {
      mortgageByMonth.set(key, row);
    }
  }

  return mortgageByMonth;
}

export function buildMonthlyBreakdown(
  budgetRows: BudgetRow[],
  mortgageRows: MortgageRow[],
  limit?: number
): BreakdownRow[] {
  const mortgageByMonth = buildMortgageByMonth(mortgageRows);
  const sortedBudget = [...budgetRows].sort((a, b) => b.date - a.date);
  const out = sortedBudget.map((row) => {
    const income = budgetTotalIn(row);
    const spend = budgetTotalOut(row);
    const mortgage = budgetMortgagePortion(mortgageByMonth.get(utcYearMonthKey(row.date)) ?? null);
    return {
      date: row.date,
      income,
      spend,
      mortgage,
      net: income - spend - mortgage
    };
  });
  return typeof limit === 'number' ? out.slice(0, limit) : out;
}
