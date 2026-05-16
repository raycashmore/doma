import type { Doc } from './_generated/dataModel';
import { mortgageTotalDebt, mortgageEquity } from './helpers';

export type BudgetRow = Doc<'budget'>;
export type MortgageRow = Doc<'mortgage'>;

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
}

export function shapeMonthDetail(
  budget: BudgetRow | null,
  mortgage: MortgageRow | null
): MonthDetail | null {
  if (!budget) return null;

  const incomeTotal =
    budget.incomePrimary + budget.incomeSecondary + budget.billContrib;
  const spendTotal =
    budget.credit1 + budget.credit2 + budget.credit3 + budget.oneOffs;

  return {
    date: budget.date,
    income: {
      primary: budget.incomePrimary,
      secondary: budget.incomeSecondary,
      billContrib: budget.billContrib,
      total: incomeTotal
    },
    spend: {
      credit1: budget.credit1,
      credit2: budget.credit2,
      credit3: budget.credit3,
      oneOffs: budget.oneOffs,
      total: spendTotal
    },
    mortgage: mortgage
      ? {
          contrib1: mortgage.contrib1,
          contrib2: mortgage.contrib2,
          contrib3: mortgage.contrib3,
          contribTotal:
            mortgage.contrib1 + mortgage.contrib2 + mortgage.contrib3,
          interestCharged: mortgage.interestCharged,
          principalPaid: mortgage.principalPaid,
          debt1: mortgage.debt1,
          debt2: mortgage.debt2,
          totalDebt: mortgageTotalDebt(mortgage),
          equity: mortgageEquity(mortgage)
        }
      : null
  };
}
