import { monthsInRange, summarizeRange } from '@repo/convex/spendingModel';
import type { MonthRange } from '@repo/convex/spendingModel';
import type { FunctionReturnType } from 'convex/server';
import type { api } from '@repo/convex';

type MonthNet = FunctionReturnType<typeof api.spending.listMonths>[number];
type Spending = FunctionReturnType<typeof api.spending.getSpending>;
type ChartMonth = Spending['months'][number];
type MonthDetail = NonNullable<FunctionReturnType<typeof api.queries.getMonthlyDetail>>;
type Insight = NonNullable<FunctionReturnType<typeof api.queries.getLatestSpendingInsight>>;

// Generic sample household, in cents. Never real finance data.
const FIXTURE_MONTHS = 18;

function monthEnds(now: Date): Array<number> {
  return Array.from({ length: FIXTURE_MONTHS }, (_, index) =>
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - FIXTURE_MONTHS + index + 1, 0)
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
  const sharedOut = 90_000;
  const fixedPayment = 260_000;
  const variablePayment = 140_000;
  return {
    date,
    primary,
    secondary,
    billContrib,
    credit1,
    credit2,
    credit3,
    oneOffs,
    sharedOut,
    fixedPayment,
    variablePayment
  };
}

const months = monthEnds(new Date()).map(sampleMonth);

const spendingMonths = months.map((month) => {
  const income = month.primary + month.secondary + month.billContrib;
  const dayToDay = month.credit1 + month.credit2 + month.credit3 + month.oneOffs;
  const mortgage = month.fixedPayment + month.variablePayment;
  const spend = dayToDay + month.sharedOut + mortgage;
  return {
    monthKey: new Date(month.date).toISOString().slice(0, 7),
    date: month.date,
    income,
    dayToDay,
    shared: month.sharedOut,
    mortgage,
    spend,
    net: income - spend
  };
});

const chartMonths: Array<ChartMonth> = spendingMonths.map((month, index) => {
  const window = spendingMonths.slice(Math.max(0, index - 5), index + 1);
  const average = (values: Array<number>) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  return {
    ...month,
    incomeAverage: average(window.map((m) => m.income)),
    spendAverage: average(window.map((m) => m.spend))
  };
});

export const fixtureMonths: Array<MonthNet> = chartMonths.map(({ monthKey, date, net }) => ({ monthKey, date, net }));

export function fixtureSpending(range: MonthRange): Spending {
  return { ...range, months: monthsInRange(chartMonths, range), summary: summarizeRange(chartMonths, range) };
}

export function fixtureDetail(date: number): MonthDetail | null {
  const month = months.find((candidate) => candidate.date === date);
  if (!month) return null;
  const cardSubtotal = month.credit1 + month.credit2 + month.credit3;
  const paymentTotal = month.fixedPayment + month.variablePayment;
  const spending = spendingMonths.find((candidate) => candidate.date === date);
  return {
    date,
    shared: month.sharedOut,
    net: spending?.net ?? 0,
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
  monthKey: spendingMonths[spendingMonths.length - 1].monthKey,
  headline: 'Sample insight: spending held steady',
  observations: ['Groceries were the largest category.', 'One-off costs were lower than usual.'],
  prediction: 'Next month should look similar.',
  generatedAt: spendingMonths[spendingMonths.length - 1].date
};
