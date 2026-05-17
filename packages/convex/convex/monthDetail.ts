import type { Doc } from './_generated/dataModel';
import { mortgageTotalDebt, mortgageEquity } from './helpers';

export type BudgetRow = Doc<'budget'>;
export type MortgageRow = Doc<'mortgage'>;

export type TrendDirection = 'up' | 'down' | 'flat';

export interface MonthDetailTrend {
  pct: number;
  direction: TrendDirection;
}

export interface MonthDetail {
  date: number;
  income: {
    primary: number;
    secondary: number;
    billContrib: number;
    total: number;
  };
  spend: {
    credit1: number;
    credit2: number;
    credit3: number;
    oneOffs: number;
    total: number;
  };
  mortgage: {
    contrib1: number;
    contrib2: number;
    contrib3: number;
    contribTotal: number;
    interestCharged: number;
    principalPaid: number;
    debt1: number;
    debt2: number;
    totalDebt: number;
    equity: number;
  } | null;
  trends: {
    income: MonthDetailTrend | null;
    spend: MonthDetailTrend | null;
    mortgage: MonthDetailTrend | null;
  };
}

function incomeTotal(b: BudgetRow): number {
  return b.incomePrimary + b.incomeSecondary + b.billContrib;
}

function spendTotal(b: BudgetRow): number {
  return b.credit1 + b.credit2 + b.credit3 + b.oneOffs;
}

function mortgageContribTotal(m: MortgageRow): number {
  return m.contrib1 + m.contrib2 + m.contrib3;
}

export function computeTrend(
  current: number,
  prior: number | null | undefined
): MonthDetailTrend | null {
  if (prior == null || prior === 0) return null;
  const pct = ((current - prior) / prior) * 100;
  const rounded = Math.round(pct * 10) / 10;
  let direction: TrendDirection;
  if (rounded > 0) direction = 'up';
  else if (rounded < 0) direction = 'down';
  else direction = 'flat';
  return { pct: rounded, direction };
}

export function shapeMonthDetail(
  budget: BudgetRow | null,
  mortgage: MortgageRow | null,
  priorBudget?: BudgetRow | null,
  priorMortgage?: MortgageRow | null
): MonthDetail | null {
  if (!budget) return null;

  const curIncome = incomeTotal(budget);
  const curSpend = spendTotal(budget);
  const curMortgageContrib = mortgage ? mortgageContribTotal(mortgage) : null;

  const priorIncome = priorBudget ? incomeTotal(priorBudget) : null;
  const priorSpend = priorBudget ? spendTotal(priorBudget) : null;
  const priorMortgageContrib = priorMortgage
    ? mortgageContribTotal(priorMortgage)
    : null;

  return {
    date: budget.date,
    income: {
      primary: budget.incomePrimary,
      secondary: budget.incomeSecondary,
      billContrib: budget.billContrib,
      total: curIncome
    },
    spend: {
      credit1: budget.credit1,
      credit2: budget.credit2,
      credit3: budget.credit3,
      oneOffs: budget.oneOffs,
      total: curSpend
    },
    mortgage: mortgage
      ? {
          contrib1: mortgage.contrib1,
          contrib2: mortgage.contrib2,
          contrib3: mortgage.contrib3,
          contribTotal: mortgageContribTotal(mortgage),
          interestCharged: mortgage.interestCharged,
          principalPaid: mortgage.principalPaid,
          debt1: mortgage.debt1,
          debt2: mortgage.debt2,
          totalDebt: mortgageTotalDebt(mortgage),
          equity: mortgageEquity(mortgage)
        }
      : null,
    trends: {
      income: computeTrend(curIncome, priorIncome),
      spend: computeTrend(curSpend, priorSpend),
      mortgage:
        curMortgageContrib != null
          ? computeTrend(curMortgageContrib, priorMortgageContrib)
          : null
    }
  };
}
