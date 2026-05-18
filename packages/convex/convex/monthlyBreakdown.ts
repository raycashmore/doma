import type { Doc } from './_generated/dataModel';
import {
  budgetTotalIn,
  budgetTotalOut,
  budgetNetGainLoss,
  budgetMortgagePortion
} from './helpers';

export type BudgetRow = Doc<'budget'>;
export type MortgageRow = Doc<'mortgage'>;

export interface BreakdownRow {
  date: number;
  income: number;
  spend: number;
  mortgage: number;
  net: number;
}

export function buildMonthlyBreakdown(
  budgetRows: BudgetRow[],
  mortgageRows: MortgageRow[],
  limit?: number
): BreakdownRow[] {
  // Exact-date join; missing mortgage rows intentionally render as 0 spend.
  const mortgageByDate = new Map(
    mortgageRows.map((row) => [row.date, row] as const)
  );
  const sortedBudget = [...budgetRows].sort((a, b) => b.date - a.date);
  const out = sortedBudget.map((row) => ({
    date: row.date,
    income: budgetTotalIn(row),
    spend: budgetTotalOut(row),
    mortgage: budgetMortgagePortion(mortgageByDate.get(row.date) ?? null),
    net: budgetNetGainLoss(row)
  }));
  return typeof limit === 'number' ? out.slice(0, limit) : out;
}
