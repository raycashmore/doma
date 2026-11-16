import { useQuery } from 'convex/react';
import { api } from '@repo/convex';
import type { TimePeriod } from '@/lib/budget';
import { periodMonthLimit } from '@/lib/budget';
import { FIXTURE_MODE } from '@/config/runtime';
import { fixtureBreakdown, fixtureChart, fixtureDetail, fixtureInsight, fixtureSummary } from '@/lib/budgetFixtures';

function useConvexBudgetData(period: TimePeriod, openMonth: number | null) {
  return {
    summary: useQuery(api.queries.getBudgetPageSummary, { period }),
    chartData: useQuery(api.queries.listBudgetChart),
    rows: useQuery(api.queries.getMonthlyBreakdown, { limit: periodMonthLimit(period) }),
    detail: useQuery(api.queries.getMonthlyDetail, openMonth !== null ? { date: openMonth } : 'skip'),
    insight: useQuery(api.queries.getLatestSpendingInsight)
  };
}

function useFixtureBudgetData(period: TimePeriod, openMonth: number | null): ReturnType<typeof useConvexBudgetData> {
  return {
    summary: fixtureSummary(period),
    chartData: fixtureChart,
    rows: fixtureBreakdown(periodMonthLimit(period)),
    detail: openMonth !== null ? fixtureDetail(openMonth) : undefined,
    insight: fixtureInsight
  };
}

export const useBudgetData = FIXTURE_MODE ? useFixtureBudgetData : useConvexBudgetData;
