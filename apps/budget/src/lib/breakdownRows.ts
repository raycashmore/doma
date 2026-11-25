import type { SpendingMonth } from '@repo/convex/spendingModel';
import type { BreakdownRowData } from '@/components/budget/BudgetBreakdownTable';

/** Newest first. Spend here is what leaves before the mortgage, which has its own column. */
export function breakdownRows(months: ReadonlyArray<SpendingMonth>): Array<BreakdownRowData> {
  return [...months].reverse().map((month) => ({
    date: month.date,
    income: month.income,
    spend: month.dayToDay + month.shared,
    mortgage: month.mortgage,
    net: month.net
  }));
}
