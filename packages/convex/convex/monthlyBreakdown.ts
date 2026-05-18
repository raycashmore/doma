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

export function utcYearMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

export function buildMortgageByMonth(
  mortgageRows: MortgageRow[]
): Map<string, MortgageRow> {
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
  const out = sortedBudget.map((row) => ({
    date: row.date,
    income: budgetTotalIn(row),
    spend: budgetTotalOut(row),
    mortgage: budgetMortgagePortion(
      mortgageByMonth.get(utcYearMonthKey(row.date)) ?? null
    ),
    net: budgetNetGainLoss(row)
  }));
  return typeof limit === 'number' ? out.slice(0, limit) : out;
}
