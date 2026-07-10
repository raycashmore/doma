import { fromCents } from '../helpers';
import { monthKeyFromTimestamp } from '../spendingSummary';

export type SpendingInsightBreakdownRow = {
  monthKey: string;
  category: string;
  amount: number;
};

export type SpendingInsightBudgetRow = {
  date: number;
  incomePrimary: number;
  incomeSecondary: number;
  billContrib: number;
  credit1: number;
  credit2: number;
  credit3: number;
  oneOffs: number;
};

export type SpendingInsightAiMonth = {
  monthKey: string;
  monthLabel: string;
  categories: Array<{ category: string; amount: number }>;
  budgetTotals?: {
    income: number;
    oneOffs: number;
    cardSpend: number;
  };
};

export type SpendingInsightAiInput = {
  targetMonthKey: string;
  months: SpendingInsightAiMonth[];
  comparisonSummary?: {
    fromPreviousMonth?: {
      monthLabel: string;
      totalSpendPercentageChange: number;
      categoryPercentageChanges: Array<{ category: string; percentageChange: number }>;
    };
    fromSameMonthLastYear?: {
      monthLabel: string;
      totalSpendPercentageChange: number;
    };
  };
};

// Include the target month plus the equivalent month a year earlier, so the
// generated update can make a year-on-year comparison.
const trailingMonthCount = 13;

// A month is eligible once both its spend category breakdown and its budget
// row exist; insights are immutable, so generating from breakdown data alone
// could permanently store an under-informed insight.
export function latestMonthKeyNeedingInsight({
  breakdownMonthKeys,
  budgetMonthKeys,
  insightMonthKeys
}: {
  breakdownMonthKeys: string[];
  budgetMonthKeys: string[];
  insightMonthKeys: string[];
}): string | null {
  const budgetMonths = new Set(budgetMonthKeys);
  const insightMonths = new Set(insightMonthKeys);
  let target: string | null = null;
  for (const monthKey of breakdownMonthKeys) {
    if (!budgetMonths.has(monthKey) || insightMonths.has(monthKey)) continue;
    if (!target || monthKey > target) target = monthKey;
  }
  return target;
}

export function buildSpendingInsightAiInput({
  targetMonthKey,
  breakdownRows,
  budgetRows
}: {
  targetMonthKey: string;
  breakdownRows: SpendingInsightBreakdownRow[];
  budgetRows: SpendingInsightBudgetRow[];
}): SpendingInsightAiInput {
  const windowMonthKeys = new Set(trailingMonthKeys(targetMonthKey));
  const budgetByMonth = new Map(budgetRows.map((row) => [monthKeyFromTimestamp(row.date), row]));

  const categoriesByMonth = new Map<string, Array<{ category: string; amount: number }>>();
  for (const row of breakdownRows) {
    if (!windowMonthKeys.has(row.monthKey)) continue;
    const categories = categoriesByMonth.get(row.monthKey) ?? [];
    categories.push({ category: row.category, amount: fromCents(row.amount) });
    categoriesByMonth.set(row.monthKey, categories);
  }

  const months = [...categoriesByMonth.keys()].sort().map((monthKey) => {
    const budget = budgetByMonth.get(monthKey);
    return {
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      categories: categoriesByMonth.get(monthKey) ?? [],
      ...(budget
        ? {
            budgetTotals: {
              income: fromCents(budget.incomePrimary + budget.incomeSecondary + budget.billContrib),
              oneOffs: fromCents(budget.oneOffs),
              cardSpend: fromCents(budget.credit1 + budget.credit2 + budget.credit3)
            }
          }
        : {})
    };
  });

  const comparisonSummary = buildComparisonSummary({ targetMonthKey, months });
  return { targetMonthKey, months, ...(comparisonSummary ? { comparisonSummary } : {}) };
}

function buildComparisonSummary({
  targetMonthKey,
  months
}: {
  targetMonthKey: string;
  months: SpendingInsightAiMonth[];
}): SpendingInsightAiInput['comparisonSummary'] {
  const byMonthKey = new Map(months.map((month) => [month.monthKey, month]));
  const targetMonth = byMonthKey.get(targetMonthKey);
  if (!targetMonth) return undefined;

  const previousMonth = byMonthKey.get(relativeMonthKey(targetMonthKey, -1));
  const sameMonthLastYear = byMonthKey.get(relativeMonthKey(targetMonthKey, -12));
  const fromPreviousMonth = previousMonth ? comparisonFromPreviousMonth({ targetMonth, previousMonth }) : undefined;
  const fromSameMonthLastYear = sameMonthLastYear
    ? comparisonFromSameMonthLastYear({ targetMonth, sameMonthLastYear })
    : undefined;

  if (!fromPreviousMonth && !fromSameMonthLastYear) return undefined;
  return {
    ...(fromPreviousMonth ? { fromPreviousMonth } : {}),
    ...(fromSameMonthLastYear ? { fromSameMonthLastYear } : {})
  };
}

function comparisonFromPreviousMonth({
  targetMonth,
  previousMonth
}: {
  targetMonth: SpendingInsightAiMonth;
  previousMonth: SpendingInsightAiMonth;
}) {
  const totalSpendPercentageChange = percentageChange(totalSpend(targetMonth), totalSpend(previousMonth));
  if (totalSpendPercentageChange === null) return undefined;

  const previousAmountsByCategory = new Map(
    previousMonth.categories.map((category) => [category.category, category.amount])
  );
  const categoryPercentageChanges = targetMonth.categories.flatMap(({ category, amount }) => {
    const percentageChangeFromPrevious = percentageChange(amount, previousAmountsByCategory.get(category));
    return percentageChangeFromPrevious === null ? [] : [{ category, percentageChange: percentageChangeFromPrevious }];
  });

  return {
    monthLabel: previousMonth.monthLabel,
    totalSpendPercentageChange,
    categoryPercentageChanges
  };
}

function comparisonFromSameMonthLastYear({
  targetMonth,
  sameMonthLastYear
}: {
  targetMonth: SpendingInsightAiMonth;
  sameMonthLastYear: SpendingInsightAiMonth;
}) {
  const totalSpendPercentageChange = percentageChange(totalSpend(targetMonth), totalSpend(sameMonthLastYear));
  if (totalSpendPercentageChange === null) return undefined;
  return { monthLabel: sameMonthLastYear.monthLabel, totalSpendPercentageChange };
}

function totalSpend(month: SpendingInsightAiMonth) {
  return month.categories.reduce((total, category) => total + category.amount, 0);
}

function percentageChange(current: number, previous: number | undefined) {
  if (previous === undefined || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function trailingSpendingInsightMonthKeys(targetMonthKey: string): string[] {
  return trailingMonthKeys(targetMonthKey);
}

function trailingMonthKeys(targetMonthKey: string): string[] {
  const [year, month] = targetMonthKey.split('-').map(Number);
  if (!year || !month) return [];

  const monthKeys: string[] = [];
  for (let offset = 0; offset < trailingMonthCount; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    monthKeys.push(monthKeyFromTimestamp(date.getTime()));
  }
  return monthKeys;
}

function relativeMonthKey(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return '';
  return monthKeyFromTimestamp(new Date(Date.UTC(year, month - 1 + offset, 1)).getTime());
}

export function monthLabelFromKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1))
  );
}
