import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@repo/convex';
import type { TimePeriod } from '@/lib/budget';
import { BudgetBreakdownTable } from '@/components/budget/BudgetBreakdownTable';
import { BudgetChart } from '@/components/budget/BudgetChart';
import { BudgetChartFilters } from '@/components/budget/BudgetChartFilters';
import { useBudgetHeaderActions } from '@/components/budget/BudgetHeaderActionsContext';
import { BudgetKpiCards } from '@/components/budget/BudgetKpiCards';
import { InsightsPanel } from '@/components/budget/InsightsPanel';
import { MonthIncomeSection } from '@/components/budget/MonthIncomeSection';
import { MonthMortgageSection } from '@/components/budget/MonthMortgageSection';
import { MonthSpendSection } from '@/components/budget/MonthSpendSection';
import { MonthlyDetailOverlay } from '@/components/budget/MonthlyDetailOverlay';

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
  const headerActions = useMemo(() => <BudgetChartFilters selected={period} onChange={setPeriod} />, [period]);

  useBudgetHeaderActions(headerActions);

  const summary = useQuery(api.queries.getBudgetPageSummary, { period });
  const chartData = useQuery(api.queries.listBudgetChart);
  const periodLimit = period === '3M' ? 3 : period === '6M' ? 6 : period === '12M' ? 12 : undefined;
  const rows = useQuery(api.queries.getMonthlyBreakdown, {
    limit: periodLimit
  });
  const detail = useQuery(api.queries.getMonthlyDetail, openMonth !== null ? { date: openMonth } : 'skip');
  const insight = useQuery(api.queries.getLatestSpendingInsight);
  const adjacentMonths = useMemo(() => {
    if (!rows || openMonth === null) {
      return { previous: null, next: null };
    }

    const monthIndex = rows.findIndex((row) => row.date === openMonth);
    if (monthIndex === -1) {
      return { previous: null, next: null };
    }

    return {
      previous: rows[monthIndex + 1] ?? null,
      next: rows[monthIndex - 1] ?? null
    };
  }, [openMonth, rows]);
  const previousMonth = adjacentMonths.previous;
  const nextMonth = adjacentMonths.next;

  return (
    <>
      <div className="flex flex-col gap-5 rounded-[28px] bg-warm-bg-card p-5 md:p-6 lg:h-full lg:min-h-0 lg:flex-row lg:gap-5 lg:overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <h2 className="sr-only">Budget overview</h2>
          <BudgetKpiCards summary={summary} />
          <BudgetChart data={chartData ?? []} period={period} onBarClick={(date) => setOpenMonth(date)} />
          <BudgetBreakdownTable rows={rows} onRowClick={(date) => setOpenMonth(date)} />
        </div>

        <InsightsPanel insight={insight} />
      </div>

      <MonthlyDetailOverlay
        open={openMonth !== null && detail !== undefined && detail !== null}
        monthLabel={openMonth !== null ? monthLabel(openMonth) : ''}
        previousMonthLabel={previousMonth ? monthLabel(previousMonth.date) : undefined}
        nextMonthLabel={nextMonth ? monthLabel(nextMonth.date) : undefined}
        onPreviousMonth={previousMonth ? () => setOpenMonth(previousMonth.date) : undefined}
        onNextMonth={nextMonth ? () => setOpenMonth(nextMonth.date) : undefined}
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
              key={openMonth ?? 'spend'}
              credit1={detail.spend.credit1}
              credit2={detail.spend.credit2}
              credit3={detail.spend.credit3}
              categories={detail.spend.categories}
              oneOffs={detail.spend.oneOffs}
              trend={detail.trends.spend}
            />
            {detail.mortgage ? (
              <MonthMortgageSection
                contribTotal={detail.mortgage.contribTotal}
                fixedPayment={detail.mortgage.fixedPayment}
                variablePayment={detail.mortgage.variablePayment}
                paymentTotal={detail.mortgage.paymentTotal}
                trend={detail.trends.mortgage}
              />
            ) : null}
          </div>
        ) : null}
      </MonthlyDetailOverlay>
    </>
  );
}
