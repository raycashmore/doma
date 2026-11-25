import { useQuery } from 'convex/react';
import { api } from '@repo/convex';
import type { TimePeriod } from '@/lib/budget';
import { periodRange } from '@/lib/budget';
import { FIXTURE_MODE } from '@/config/runtime';
import { fixtureDetail, fixtureInsight, fixtureMonths, fixtureSpending } from '@/lib/budgetFixtures';

function useConvexBudgetData(period: TimePeriod, openMonth: number | null) {
  const months = useQuery(api.spending.listMonths);
  const range = months ? periodRange(period, months) : null;
  return {
    spending: useQuery(api.spending.getSpending, range ?? 'skip'),
    hasMonths: months === undefined ? undefined : months.length > 0,
    detail: useQuery(api.queries.getMonthlyDetail, openMonth !== null ? { date: openMonth } : 'skip'),
    insight: useQuery(api.queries.getLatestSpendingInsight)
  };
}

function useFixtureBudgetData(period: TimePeriod, openMonth: number | null): ReturnType<typeof useConvexBudgetData> {
  const range = periodRange(period, fixtureMonths);
  return {
    spending: range ? fixtureSpending(range) : undefined,
    hasMonths: fixtureMonths.length > 0,
    detail: openMonth !== null ? fixtureDetail(openMonth) : undefined,
    insight: fixtureInsight
  };
}

export const useBudgetData = FIXTURE_MODE ? useFixtureBudgetData : useConvexBudgetData;
