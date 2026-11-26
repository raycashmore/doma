import type { Doc } from './_generated/dataModel';
import { budgetMortgagePortion, budgetTotalIn, budgetTotalOut } from './helpers';
import { buildMortgageByMonth, utcYearMonthKey } from './monthlyBreakdown';
import { monthKeyFromTimestamp } from './spendingSummary';

type BudgetRow = Doc<'budget'>;
type MortgageRow = Doc<'mortgage'>;

/** A calendar month as `YYYY-MM`, taken from a budget row's month-end date in UTC. */
export type MonthKey = string;

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const AVERAGE_WINDOW = 6;

/**
 * One month of Spending. This is the only place income, spend and net are defined; every
 * figure, chart, list and detail on the web and in the apps uses it (RAY-259 defaults).
 */
export type SpendingMonth = {
  monthKey: MonthKey;
  date: number;
  /** Primary + secondary income + bill contributions. */
  income: number;
  /** Cards + one-offs. */
  dayToDay: number;
  /** Shared outgoings. */
  shared: number;
  /** Mortgage payments in the month (0 when no mortgage row). */
  mortgage: number;
  /** Everything that leaves: day-to-day + shared + mortgage. */
  spend: number;
  net: number;
};

export type ChartMonth = SpendingMonth & {
  /** Trailing averages over this month and up to five before it, across all history. */
  incomeAverage: number;
  spendAverage: number;
};

export type SummaryMetric = {
  value: number;
  delta: number | null;
  deltaPct: number | null;
};

export type MonthRange = { from: MonthKey; to: MonthKey };

export type SpendingSummary = {
  monthCount: number;
  avgIncome: SummaryMetric;
  avgSpend: SummaryMetric;
  avgNet: SummaryMetric;
  /** Basis points: 12.34% is 1234. */
  savingsRate: SummaryMetric;
  /** The months of the same length just before the range that had data, or null when there are none. */
  comparison: (MonthRange & { monthCount: number }) | null;
};

export function isMonthKey(value: string): value is MonthKey {
  return MONTH_KEY.test(value);
}

export function shiftMonth(key: MonthKey, months: number): MonthKey {
  const [year, month] = key.split('-').map(Number) as [number, number];
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Inclusive count of calendar months from `from` to `to`. */
export function monthSpan(from: MonthKey, to: MonthKey): number {
  const [fromYear, fromMonth] = from.split('-').map(Number) as [number, number];
  const [toYear, toMonth] = to.split('-').map(Number) as [number, number];
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

export function spendingMonth(row: BudgetRow, mortgage: MortgageRow | null): SpendingMonth {
  const income = budgetTotalIn(row);
  const shared = row.sharedOut;
  const dayToDay = budgetTotalOut(row) - shared;
  const mortgagePayment = budgetMortgagePortion(mortgage);
  const spend = dayToDay + shared + mortgagePayment;
  return {
    monthKey: monthKeyFromTimestamp(row.date),
    date: row.date,
    income,
    dayToDay,
    shared,
    mortgage: mortgagePayment,
    spend,
    net: income - spend
  };
}

/** Every month with data, oldest first, with trailing averages. One row per month: the latest wins, then the newest created. */
export function buildSpendingMonths(budgetRows: BudgetRow[], mortgageRows: MortgageRow[]): ChartMonth[] {
  const mortgageByMonth = buildMortgageByMonth(mortgageRows);
  const byMonth = new Map<MonthKey, BudgetRow>();
  for (const row of budgetRows) {
    const key = monthKeyFromTimestamp(row.date);
    const existing = byMonth.get(key);
    if (
      !existing ||
      row.date > existing.date ||
      (row.date === existing.date && row._creationTime > existing._creationTime)
    ) {
      byMonth.set(key, row);
    }
  }

  const months = [...byMonth.values()]
    .sort((a, b) => a.date - b.date)
    .map((row) => spendingMonth(row, mortgageByMonth.get(utcYearMonthKey(row.date)) ?? null));

  return months.map((month, index) => {
    const window = months.slice(Math.max(0, index - AVERAGE_WINDOW + 1), index + 1);
    return {
      ...month,
      incomeAverage: average(window.map((m) => m.income)),
      spendAverage: average(window.map((m) => m.spend))
    };
  });
}

export function monthsInRange<T extends { monthKey: MonthKey }>(months: T[], range: MonthRange): T[] {
  return months.filter((month) => month.monthKey >= range.from && month.monthKey <= range.to);
}

export function summarizeRange(months: SpendingMonth[], range: MonthRange): SpendingSummary {
  const current = monthsInRange(months, range);
  const span = monthSpan(range.from, range.to);
  const comparisonRange = { from: shiftMonth(range.from, -span), to: shiftMonth(range.from, -1) };
  const previous = monthsInRange(months, comparisonRange);

  const now = totals(current);
  const before = previous.length > 0 ? totals(previous) : null;

  return {
    monthCount: current.length,
    avgIncome: metric(now.avgIncome, before?.avgIncome),
    avgSpend: metric(now.avgSpend, before?.avgSpend),
    avgNet: metric(now.avgNet, before?.avgNet),
    savingsRate: metric(now.savingsRate, before?.savingsRate),
    comparison: before ? { ...comparisonRange, monthCount: previous.length } : null
  };
}

function totals(months: SpendingMonth[]) {
  const income = sum(months.map((m) => m.income));
  const net = sum(months.map((m) => m.net));
  return {
    avgIncome: average(months.map((m) => m.income)),
    avgSpend: average(months.map((m) => m.spend)),
    avgNet: average(months.map((m) => m.net)),
    savingsRate: income === 0 ? 0 : noNegativeZero(Math.round((net / income) * 10_000))
  };
}

function metric(value: number, previous: number | undefined): SummaryMetric {
  if (previous === undefined) return { value, delta: null, deltaPct: null };
  const delta = value - previous;
  return { value, delta, deltaPct: previous === 0 ? null : noNegativeZero((delta / Math.abs(previous)) * 100) };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : noNegativeZero(Math.round(sum(values) / values.length));
}

/** Convex sends -0 as a special float, which clients reading whole numbers cannot decode. */
export function noNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}
