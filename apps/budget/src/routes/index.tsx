import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@repo/convex';
import type { TimePeriod } from '@/lib/budget';
import BudgetChart from '@/components/budget/BudgetChart';
import BudgetChartFilters from '@/components/budget/BudgetChartFilters';
import BudgetKpiCards from '@/components/budget/BudgetKpiCards';
import BudgetBreakdownTable from '@/components/budget/BudgetBreakdownTable';
import InsightsPanel from '@/components/budget/InsightsPanel';
import MonthlyDetailOverlay from '@/components/budget/MonthlyDetailOverlay';
import MonthIncomeSection from '@/components/budget/MonthIncomeSection';
import MonthSpendSection from '@/components/budget/MonthSpendSection';
import MonthMortgageSection from '@/components/budget/MonthMortgageSection';
import SummaryMini from '@/components/budget/SummaryMini';

export const Route = createFileRoute('/')({
  component: BudgetPage
});

function monthLabel(date: number) {
  return new Date(date).toLocaleString('en-AU', {
    month: 'long',
    year: 'numeric'
  });
}

function BudgetPage() {
  const [period, setPeriod] = useState<TimePeriod>('12M');
  const [openMonth, setOpenMonth] = useState<number | null>(null);

  const summary = useQuery(api.queries.getBudgetPageSummary, { period });
  const chartData = useQuery(api.queries.listBudgetChart);
  const periodLimit =
    period === '3M'
      ? 3
      : period === '6M'
        ? 6
        : period === '12M'
          ? 12
          : undefined;
  const rows = useQuery(api.queries.getMonthlyBreakdown, {
    limit: periodLimit
  });
  const detail = useQuery(
    api.queries.getMonthlyDetail,
    openMonth !== null ? { date: openMonth } : 'skip'
  );

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden rounded-[28px] bg-warm-bg-card p-6 md:flex-row md:gap-5">
        <div className="flex min-h-0 flex-1 flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="sr-only">Budget overview</h2>
            <BudgetChartFilters selected={period} onChange={setPeriod} />
          </div>

          <BudgetKpiCards summary={summary} />

          <BudgetChart data={chartData ?? []} period={period} />

          <BudgetBreakdownTable
            rows={rows}
            onRowClick={(date) => setOpenMonth(date)}
          />
        </div>

        <InsightsPanel />
      </div>

      <MonthlyDetailOverlay
        open={openMonth !== null && detail !== undefined && detail !== null}
        monthLabel={openMonth !== null ? monthLabel(openMonth) : ''}
        subtitle="Income, spend and mortgage contributions for the selected month"
        onClose={() => setOpenMonth(null)}
      >
        {detail ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <SummaryMini
                label="Income"
                value={detail.income.total}
                fill="bg-warm-section-income"
                trend={detail.trends.income}
              />
              <SummaryMini
                label="Spend"
                value={detail.spend.total}
                fill="bg-warm-section-spend"
                trend={detail.trends.spend}
              />
              <SummaryMini
                label="Mortgage"
                value={detail.mortgage?.contribTotal ?? 0}
                fill="bg-warm-section-mortgage"
                trend={detail.trends.mortgage}
              />
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <MonthIncomeSection
                primary={detail.income.primary}
                secondary={detail.income.secondary}
                billContrib={detail.income.billContrib}
              />
              <MonthSpendSection
                credit1={detail.spend.credit1}
                credit2={detail.spend.credit2}
                credit3={detail.spend.credit3}
                oneOffs={detail.spend.oneOffs}
              />
              {detail.mortgage ? (
                <MonthMortgageSection
                  contribTotal={detail.mortgage.contribTotal}
                  interestCharged={detail.mortgage.interestCharged}
                  principalPaid={detail.mortgage.principalPaid}
                  debt1={detail.mortgage.debt1}
                  debt2={detail.mortgage.debt2}
                  equity={detail.mortgage.equity}
                />
              ) : null}
            </div>
          </>
        ) : null}
      </MonthlyDetailOverlay>
    </>
  );
}
