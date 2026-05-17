import type { Doc } from './_generated/dataModel';
import {
  budgetTotalIn,
  budgetTotalOut,
  budgetNetGainLoss,
  budgetMortgagePortion
} from './helpers';

export type BudgetRow = Doc<'budget'>;

export interface BreakdownRow {
  date: number;
  income: number;
  spend: number;
  mortgage: number;
  net: number;
}

export function buildMonthlyBreakdown(
  budgetRows: BudgetRow[],
  limit?: number
): BreakdownRow[] {
  const sortedBudget = [...budgetRows].sort((a, b) => b.date - a.date);
  const out = sortedBudget.map((row) => ({
    date: row.date,
    income: budgetTotalIn(row),
    spend: budgetTotalOut(row),
    mortgage: budgetMortgagePortion(row),
    net: budgetNetGainLoss(row)
  }));
  return typeof limit === 'number' ? out.slice(0, limit) : out;
}
