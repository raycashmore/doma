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
};

const trailingMonthCount = 12;

export function latestMonthKeyNeedingInsight({
  breakdownMonthKeys,
  insightMonthKeys
}: {
  breakdownMonthKeys: string[];
  insightMonthKeys: string[];
}): string | null {
  let latest: string | null = null;
  for (const monthKey of breakdownMonthKeys) {
    if (!latest || monthKey > latest) latest = monthKey;
  }
  if (!latest) return null;
  return insightMonthKeys.includes(latest) ? null : latest;
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

  return { targetMonthKey, months };
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

function monthLabelFromKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1))
  );
}
