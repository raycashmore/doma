import { KpiCard } from './KpiCard';
import type { SpendingSummary } from '@repo/convex/spendingModel';
import type { TimePeriod } from '@/lib/budget';
import { comparisonLabel, periodLabel } from '@/lib/budget';

type Props = {
  summary: SpendingSummary | undefined;
  period: TimePeriod;
};

function SkeletonRow() {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-warm-bg-card-soft" />
      ))}
    </div>
  );
}

export function BudgetKpiCards({ summary, period }: Props) {
  if (!summary) return <SkeletonRow />;
  const labels = { periodLabel: periodLabel(period), comparisonLabel: comparisonLabel(summary) };

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3.5">
      <KpiCard
        label="Avg spend"
        value={summary.avgSpend.value}
        delta={summary.avgSpend.delta}
        deltaPct={summary.avgSpend.deltaPct}
        kind="money"
        {...labels}
      />
      <KpiCard
        label="Avg income"
        value={summary.avgIncome.value}
        delta={summary.avgIncome.delta}
        deltaPct={summary.avgIncome.deltaPct}
        kind="money"
        {...labels}
      />
      <KpiCard
        label="Savings rate"
        value={summary.savingsRate.value}
        delta={summary.savingsRate.delta}
        deltaPct={summary.savingsRate.deltaPct}
        kind="rate"
        {...labels}
      />
      <KpiCard
        label="Avg gain"
        value={summary.avgNet.value}
        delta={summary.avgNet.delta}
        deltaPct={summary.avgNet.deltaPct}
        kind="money"
        {...labels}
      />
    </div>
  );
}
