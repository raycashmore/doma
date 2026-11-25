import { shiftMonth } from '@repo/convex/spendingModel';
import type { MonthKey, MonthRange, SpendingSummary } from '@repo/convex/spendingModel';

export type TimePeriod = '3M' | '6M' | '12M' | 'ALL';

/** Resolves a period tab against the months that have data: the last N months, or all of them. */
export function periodRange(period: TimePeriod, months: ReadonlyArray<{ monthKey: MonthKey }>): MonthRange | null {
  if (months.length === 0) return null;
  const first = months[0];
  const last = months[months.length - 1];
  if (period === 'ALL') return { from: first.monthKey, to: last.monthKey };
  const count = period === '3M' ? 3 : period === '6M' ? 6 : 12;
  return { from: shiftMonth(last.monthKey, -(count - 1)), to: last.monthKey };
}

export function periodLabel(period: TimePeriod): string {
  return period === 'ALL' ? 'All time' : `Last ${period.replace('M', '')} months`;
}

export function comparisonLabel(summary: SpendingSummary): string {
  return summary.comparison ? `vs prior ${summary.comparison.monthCount} mo` : 'No earlier months';
}

export function formatDateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatCurrency(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars < 0) {
    return `-$${Math.abs(dollars).toLocaleString('en-AU')}`;
  }
  return `$${dollars.toLocaleString('en-AU')}`;
}
