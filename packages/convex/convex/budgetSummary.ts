import type { Doc } from './_generated/dataModel';
import { budgetTotalIn, budgetTotalOut, budgetNetGainLoss } from './helpers';

export type SummaryPeriod = '3M' | '6M' | '12M' | 'ALL';
export type BudgetRow = Doc<'budget'>;

export interface SummaryMetric {
  value: number; // cents (or basis points for savingsRate)
  delta: number | null;
  deltaPct: number | null;
}

export interface BudgetPageSummary {
  avgSpend: SummaryMetric;
  avgIncome: SummaryMetric;
  savingsRate: SummaryMetric;
  netGain: SummaryMetric;
  periodLabel: string;
}

const MS_PER_MONTH = 30 * 86_400_000;

function windowMs(period: SummaryPeriod): number | null {
  if (period === 'ALL') return null;
  const months = period === '3M' ? 3 : period === '6M' ? 6 : 12;
  return months * MS_PER_MONTH;
}

function labelFor(period: SummaryPeriod): string {
  return period === 'ALL' ? 'All time' : `${period.replace('M', '')} mo`;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return Math.round(sum / values.length);
}

function metric(current: number, prior: number | null): SummaryMetric {
  if (prior === null) return { value: current, delta: null, deltaPct: null };
  const delta = current - prior;
  const deltaPct = prior === 0 ? null : (delta / Math.abs(prior)) * 100;
  return { value: current, delta, deltaPct };
}

function computeWindow(rows: BudgetRow[]) {
  const ins = rows.map(budgetTotalIn);
  const outs = rows.map(budgetTotalOut);
  const nets = rows.map(budgetNetGainLoss);
  const avgIn = avg(ins);
  const avgOut = avg(outs);
  const totalIn = ins.reduce((s, x) => s + x, 0);
  const totalNet = nets.reduce((s, x) => s + x, 0);
  // basis points: 12.34% -> 1234
  const savingsBp =
    totalIn === 0 ? 0 : Math.round((totalNet / totalIn) * 10_000);
  return {
    avgSpend: avgOut,
    avgIncome: avgIn,
    savingsRate: savingsBp,
    netGain: avg(nets)
  };
}

export function summarizeBudgetForPeriod(
  rows: BudgetRow[],
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
      periodLabel: labelFor(period)
    };
  }

  const sorted = [...rows].sort((a, b) => a.date - b.date);
  const window = windowMs(period);

  let currentRows: BudgetRow[];
  let priorRows: BudgetRow[];

  if (window === null) {
    currentRows = sorted;
    priorRows = [];
  } else {
    const currentStart = now - window;
    const priorStart = currentStart - window;
    currentRows = sorted.filter((r) => r.date > currentStart && r.date <= now);
    priorRows = sorted.filter(
      (r) => r.date > priorStart && r.date <= currentStart
    );
  }

  const cur = computeWindow(currentRows);
  const prior = priorRows.length > 0 ? computeWindow(priorRows) : null;

  return {
    avgSpend: metric(cur.avgSpend, prior?.avgSpend ?? null),
    avgIncome: metric(cur.avgIncome, prior?.avgIncome ?? null),
    savingsRate: metric(cur.savingsRate, prior?.savingsRate ?? null),
    netGain: metric(cur.netGain, prior?.netGain ?? null),
    periodLabel: labelFor(period)
  };
}
