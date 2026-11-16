import type { FunctionReturnType } from 'convex/server';
import type { api } from '@repo/convex';
import type { TimePeriod } from '@/lib/budget';
import { periodMonthLimit } from '@/lib/budget';

type Summary = FunctionReturnType<typeof api.queries.getBudgetPageSummary>;
type ChartPoint = FunctionReturnType<typeof api.queries.listBudgetChart>[number];
type BreakdownRow = FunctionReturnType<typeof api.queries.getMonthlyBreakdown>[number];
type MonthDetail = NonNullable<FunctionReturnType<typeof api.queries.getMonthlyDetail>>;
type Insight = NonNullable<FunctionReturnType<typeof api.queries.getLatestSpendingInsight>>;

// Generic sample household, in cents. Never real finance data.
const FIXTURE_MONTHS = 18;

function monthStarts(now: Date): Array<number> {
  return Array.from({ length: FIXTURE_MONTHS }, (_, index) =>
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - FIXTURE_MONTHS + index, 1)
  );
}

function sampleMonth(date: number, index: number) {
  const wobble = ((index * 37) % 11) - 5;
  const primary = 900_000;
  const secondary = 450_000 + wobble * 5_000;
  const billContrib = 60_000;
  const credit1 = 210_000 + wobble * 9_000;
  const credit2 = 120_000 - wobble * 4_000;
  const credit3 = 45_000;
  const oneOffs = index % 4 === 0 ? 80_000 : 15_000;
  const fixedPayment = 260_000;
  const variablePayment = 140_000;
  return { date, primary, secondary, billContrib, credit1, credit2, credit3, oneOffs, fixedPayment, variablePayment };
}

const months = monthStarts(new Date()).map(sampleMonth);

function breakdownRow(month: (typeof months)[number]): BreakdownRow {
  const income = month.primary + month.secondary + month.billContrib;
  const spend = month.credit1 + month.credit2 + month.credit3 + month.oneOffs;
  const mortgage = month.fixedPayment + month.variablePayment;
  return { date: month.date, income, spend, mortgage, net: income - spend - mortgage };
}

const breakdownNewestFirst = months.map(breakdownRow).reverse();

export const fixtureChart: Array<ChartPoint> = breakdownNewestFirst
  .map((row) => ({ date: row.date, spend: row.spend, sinkOrSwim: row.net, mortgage: row.mortgage }))
  .reverse();

export function fixtureBreakdown(limit: number | undefined): Array<BreakdownRow> {
  return breakdownNewestFirst.slice(0, limit);
}

function average(values: Array<number>) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function fixtureSummary(period: TimePeriod): Summary {
  const rows = fixtureBreakdown(periodMonthLimit(period));
  const [latest, prior] = breakdownNewestFirst;
  const metric = (value: number, pick: (row: BreakdownRow) => number) => {
    const delta = pick(latest) - pick(prior);
    return { value, delta, deltaPct: Math.round((delta / pick(prior)) * 100) };
  };
  const savings = (row: BreakdownRow) => Math.round((row.net / row.income) * 10_000);
  return {
    avgSpend: metric(average(rows.map((row) => row.spend)), (row) => row.spend),
    avgIncome: metric(average(rows.map((row) => row.income)), (row) => row.income),
    savingsRate: metric(average(rows.map(savings)), savings),
    netGain: metric(average(rows.map((row) => row.net)), (row) => row.net),
    periodLabel: period === 'ALL' ? 'All time' : `Trailing ${period.replace('M', '')} months`,
    comparisonLabel: 'vs prior month'
  };
}

export function fixtureDetail(date: number): MonthDetail | null {
  const month = months.find((candidate) => candidate.date === date);
  if (!month) return null;
  const cardSubtotal = month.credit1 + month.credit2 + month.credit3;
  const paymentTotal = month.fixedPayment + month.variablePayment;
  return {
    date,
    income: {
      primary: month.primary,
      secondary: month.secondary,
      billContrib: month.billContrib,
      total: month.primary + month.secondary + month.billContrib
    },
    spend: {
      credit1: month.credit1,
      credit2: month.credit2,
      credit3: month.credit3,
      cardSubtotal,
      categories: [
        { category: 'Groceries', amount: Math.round(cardSubtotal * 0.4) },
        { category: 'Transport', amount: Math.round(cardSubtotal * 0.25) },
        { category: 'Eating out', amount: Math.round(cardSubtotal * 0.2) }
      ],
      oneOffs: month.oneOffs,
      total: cardSubtotal + month.oneOffs
    },
    mortgage: {
      contrib1: 200_000,
      contrib2: 150_000,
      contrib3: 50_000,
      contribTotal: 400_000,
      fixedPayment: month.fixedPayment,
      variablePayment: month.variablePayment,
      paymentTotal,
      rateVar: 6.1,
      rateFixed: 5.6,
      offset1: 2_500_000,
      offset2: 500_000,
      debt1: 40_000_000,
      debt2: 15_000_000,
      totalDebt: 55_000_000,
      equity: 45_000_000
    },
    trends: {
      income: { pct: 2, direction: 'up' },
      spend: { pct: 4, direction: 'down' },
      mortgage: { pct: 0, direction: 'flat' }
    }
  };
}

export const fixtureInsight: Insight = {
  monthKey: new Date(breakdownNewestFirst[0].date).toISOString().slice(0, 7),
  headline: 'Sample insight: spending held steady',
  observations: ['Groceries were the largest category.', 'One-off costs were lower than usual.'],
  prediction: 'Next month should look similar.',
  generatedAt: breakdownNewestFirst[0].date
};
