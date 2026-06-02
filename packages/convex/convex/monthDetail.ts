import type { Doc } from './_generated/dataModel';
import {
  mortgageConfigForTotals,
  type MortgageConfigInput,
  mortgageContrib,
  mortgageEquity,
  mortgagePaymentTotal,
  mortgageTotalDebt
} from './helpers';

export type BudgetRow = Doc<'budget'>;
export type MortgageRow = Doc<'mortgage'>;
export type SpendCategoryBreakdownRow = Doc<'spendCategoryBreakdown'>;

export type TrendDirection = 'up' | 'down' | 'flat';

export type MonthDetailTrend = {
  pct: number;
  direction: TrendDirection;
};

export type MonthDetail = {
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
    cardSubtotal: number;
    categories: Array<{
      category: string;
      amount: number;
    }>;
    oneOffs: number;
    total: number;
  };
  mortgage: {
    contrib1: number;
    contrib2: number;
    contrib3: number;
    contribTotal: number;
    fixedPayment: number;
    variablePayment: number;
    paymentTotal: number;
    rateVar: number | undefined;
    rateFixed: number | undefined;
    offset1: number;
    offset2: number;
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
};

function incomeTotal(b: BudgetRow): number {
  return b.incomePrimary + b.incomeSecondary + b.billContrib;
}

function spendTotal(b: BudgetRow): number {
  return b.credit1 + b.credit2 + b.credit3 + b.oneOffs;
}

function cardSubtotal(b: BudgetRow): number {
  return b.credit1 + b.credit2 + b.credit3;
}

export function computeTrend(current: number, prior: number | null | undefined): MonthDetailTrend | null {
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
  mortgageConfig: MortgageConfigInput | null,
  priorBudget?: BudgetRow | null,
  priorMortgage?: MortgageRow | null,
  spendCategoryRows: SpendCategoryBreakdownRow[] = []
): MonthDetail | null {
  if (!budget) return null;

  const config = mortgageConfigForTotals(mortgageConfig);
  const curIncome = incomeTotal(budget);
  const curSpend = spendTotal(budget);
  const curMortgagePayment = mortgage ? mortgagePaymentTotal(mortgage) : null;

  const priorIncome = priorBudget ? incomeTotal(priorBudget) : null;
  const priorSpend = priorBudget ? spendTotal(priorBudget) : null;
  const priorMortgagePayment = priorMortgage ? mortgagePaymentTotal(priorMortgage) : null;

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
      cardSubtotal: cardSubtotal(budget),
      categories: [...spendCategoryRows]
        .sort((a, b) => b.amount - a.amount)
        .map((row) => ({
          category: row.category,
          amount: row.amount
        })),
      oneOffs: budget.oneOffs,
      total: curSpend
    },
    mortgage: mortgage
      ? {
          contrib1: config.contrib1,
          contrib2: config.contrib2,
          contrib3: config.contrib3,
          contribTotal: mortgageContrib(config),
          fixedPayment: mortgage.fixedPayment,
          variablePayment: mortgage.variablePayment,
          paymentTotal: mortgagePaymentTotal(mortgage),
          rateVar: mortgage.rateVar,
          rateFixed: mortgage.rateFixed,
          offset1: mortgage.offset1,
          offset2: mortgage.offset2,
          debt1: mortgage.debt1,
          debt2: mortgage.debt2,
          totalDebt: mortgageTotalDebt(mortgage),
          equity: mortgageEquity(mortgage, config)
        }
      : null,
    trends: {
      income: computeTrend(curIncome, priorIncome),
      spend: computeTrend(curSpend, priorSpend),
      mortgage: curMortgagePayment != null ? computeTrend(curMortgagePayment, priorMortgagePayment) : null
    }
  };
}
