import type { Doc } from './_generated/dataModel';
import {
  budgetTotalIn,
  budgetTotalOut,
  budgetNetGainLoss
} from './helpers';

export type BudgetRow = Doc<'budget'>;
export type MortgageRow = Doc<'mortgage'>;

export interface BreakdownRow {
  date: number;
  income: number;
  spend: number;
  mortgage: number | null;
  net: number;
}

function mortgageContrib(m: MortgageRow): number {
  return m.contrib1 + m.contrib2 + m.contrib3;
}

export function joinBudgetWithMortgage(
  budgetRows: BudgetRow[],
  mortgageRows: MortgageRow[],
  limit?: number
): BreakdownRow[] {
  const sortedBudget = [...budgetRows].sort((a, b) => a.date - b.date);
  const sortedMortgage = [...mortgageRows].sort((a, b) => a.date - b.date);

  // Two-pointer carry-forward
  let mIdx = 0;
  let lastMortgage: MortgageRow | null = null;
  const out: BreakdownRow[] = [];
  for (const row of sortedBudget) {
    while (mIdx < sortedMortgage.length) {
      const candidate = sortedMortgage[mIdx];
      if (candidate === undefined || candidate.date > row.date) break;
      lastMortgage = candidate;
      mIdx += 1;
    }
    out.push({
      date: row.date,
      income: budgetTotalIn(row),
      spend: budgetTotalOut(row),
      mortgage: lastMortgage ? mortgageContrib(lastMortgage) : null,
      net: budgetNetGainLoss(row)
    });
  }

  out.reverse(); // desc
  return typeof limit === 'number' ? out.slice(0, limit) : out;
}
