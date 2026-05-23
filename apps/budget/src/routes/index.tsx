import { useMemo, useState } from 'react';
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
import { useBudgetHeaderActions } from '@/components/budget/BudgetHeaderActionsContext';

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
  const headerActions = useMemo(
    () => <BudgetChartFilters selected={period} onChange={setPeriod} />,
    [period]
  );

  useBudgetHeaderActions(headerActions);

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
      <div className="flex flex-col gap-5 rounded-[28px] bg-warm-bg-card p-5 md:p-6 lg:h-full lg:min-h-0 lg:flex-row lg:gap-5 lg:overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <h2 className="sr-only">Budget overview</h2>
          <BudgetKpiCards summary={summary} />
          <BudgetChart
            data={chartData ?? []}
            period={period}
            onBarClick={(date) => setOpenMonth(date)}
          />
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
          <div className="flex flex-col md:flex-row gap-4 md:h-full">
            <MonthIncomeSection
              primary={detail.income.primary}
              secondary={detail.income.secondary}
              billContrib={detail.income.billContrib}
              trend={detail.trends.income}
            />
            <MonthSpendSection
              credit1={detail.spend.credit1}
              credit2={detail.spend.credit2}
              credit3={detail.spend.credit3}
              oneOffs={detail.spend.oneOffs}
              trend={detail.trends.spend}
            />
            {detail.mortgage ? (
              <MonthMortgageSection
                contribTotal={detail.mortgage.contribTotal}
                fixedPayment={detail.mortgage.fixedPayment}
                variablePayment={detail.mortgage.variablePayment}
                paymentTotal={detail.mortgage.paymentTotal}
                offset1={detail.mortgage.offset1}
                offset2={detail.mortgage.offset2}
                debt1={detail.mortgage.debt1}
                debt2={detail.mortgage.debt2}
                equity={detail.mortgage.equity}
                trend={detail.trends.mortgage}
              />
            ) : null}
          </div>
        ) : null}
      </MonthlyDetailOverlay>
    </>
  );
}
