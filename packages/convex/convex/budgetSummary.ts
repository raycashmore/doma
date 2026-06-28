import type { Doc } from './_generated/dataModel';
import { budgetMortgagePortion, budgetTotalIn, budgetTotalOut } from './helpers';
import { buildMortgageByMonth, type MortgageRow, utcYearMonthKey } from './monthlyBreakdown';

export type SummaryPeriod = '3M' | '6M' | '12M' | 'ALL';
export type BudgetRow = Doc<'budget'>;

export type SummaryMetric = {
  value: number; // cents (or basis points for savingsRate)
  delta: number | null;
  deltaPct: number | null;
};

export type BudgetPageSummary = {
  avgSpend: SummaryMetric;
  avgIncome: SummaryMetric;
  savingsRate: SummaryMetric;
  netGain: SummaryMetric;
  periodLabel: string;
  comparisonLabel: string;
};

const MS_PER_MONTH = 30 * 86_400_000;

function windowMs(period: SummaryPeriod): number | null {
  if (period === 'ALL') return null;
  const months = period === '3M' ? 3 : period === '6M' ? 6 : 12;
  return months * MS_PER_MONTH;
}

function labelFor(period: SummaryPeriod): string {
  return period === 'ALL' ? 'All time' : `Trailing ${period.replace('M', '')} months`;
}

function comparisonLabelFor(row: BudgetRow | null): string {
  if (row === null) return 'vs prior month';
  const month = new Intl.DateTimeFormat('en-AU', { month: 'short', timeZone: 'UTC' }).format(new Date(row.date));
  return `vs ${month}`;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return Math.round(sum / values.length);
}

function metric(value: number, currentMonth: number, priorMonth: number | null): SummaryMetric {
  if (priorMonth === null) return { value, delta: null, deltaPct: null };
  const delta = currentMonth - priorMonth;
  const deltaPct = priorMonth === 0 ? null : (delta / Math.abs(priorMonth)) * 100;
  return { value, delta, deltaPct };
}

function computeWindow(rows: BudgetRow[], mortgageByMonth: Map<string, MortgageRow>) {
  const ins = rows.map(budgetTotalIn);
  const outs = rows.map(
    (r) => budgetTotalOut(r) + budgetMortgagePortion(mortgageByMonth.get(utcYearMonthKey(r.date)) ?? null)
  );
  const nets = ins.map((income, i) => income - outs[i]!);
  const avgIn = avg(ins);
  const avgOut = avg(outs);
  const totalIn = ins.reduce((s, x) => s + x, 0);
  const totalNet = nets.reduce((s, x) => s + x, 0);
  // basis points: 12.34% -> 1234
  const savingsBp = totalIn === 0 ? 0 : Math.round((totalNet / totalIn) * 10_000);
  return {
    avgSpend: avgOut,
    avgIncome: avgIn,
    savingsRate: savingsBp,
    netGain: avg(nets)
  };
}

export function summarizeBudgetForPeriod(
  rows: BudgetRow[],
  mortgageRows: MortgageRow[],
  period: SummaryPeriod,
  now: number
): BudgetPageSummary {
  if (rows.length === 0) {
    const empty = { value: 0, delta: null, deltaPct: null };
    return {
      avgSpend: empty,
      avgIncome: empty,
      savingsRate: empty,
      netGain: empty,
      periodLabel: labelFor(period),
      comparisonLabel: comparisonLabelFor(null)
    };
  }

  const sorted = [...rows].sort((a, b) => a.date - b.date);
  const window = windowMs(period);

  let currentRows: BudgetRow[];
  if (window === null) {
    currentRows = sorted;
  } else {
    const currentStart = now - window;
    currentRows = sorted.filter((r) => r.date > currentStart && r.date <= now);
  }

  const mortgageByMonth = buildMortgageByMonth(mortgageRows);

  const cur = computeWindow(currentRows, mortgageByMonth);
  const comparisonRows = sorted.filter((row) => row.date <= now).slice(-2);
  const currentMonth = computeWindow(comparisonRows.slice(-1), mortgageByMonth);
  const priorMonth = comparisonRows.length === 2 ? computeWindow(comparisonRows.slice(0, 1), mortgageByMonth) : null;

  return {
    avgSpend: metric(cur.avgSpend, currentMonth.avgSpend, priorMonth?.avgSpend ?? null),
    avgIncome: metric(cur.avgIncome, currentMonth.avgIncome, priorMonth?.avgIncome ?? null),
    savingsRate: metric(cur.savingsRate, currentMonth.savingsRate, priorMonth?.savingsRate ?? null),
    netGain: metric(cur.netGain, currentMonth.netGain, priorMonth?.netGain ?? null),
    periodLabel: labelFor(period),
    comparisonLabel: comparisonLabelFor(comparisonRows.length === 2 ? comparisonRows[0]! : null)
  };
}
