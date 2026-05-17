import { KpiCard } from './KpiCard';
import type { BudgetPageSummary } from '@repo/convex/budgetSummary';

interface Props {
  summary: BudgetPageSummary | undefined;
}

function SkeletonRow() {
  return (
    <div className="flex gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[88px] flex-1 animate-pulse rounded-2xl bg-warm-bg-card-soft"
        />
      ))}
    </div>
  );
}

export default function BudgetKpiCards({ summary }: Props) {
  if (!summary) return <SkeletonRow />;

  return (
    <div className="flex gap-3">
      <KpiCard
        label="Avg spend"
        value={summary.avgSpend.value}
        delta={summary.avgSpend.delta}
        deltaPct={summary.avgSpend.deltaPct}
        kind="money"
        periodLabel={summary.periodLabel}
      />
      <KpiCard
        label="Avg income"
        value={summary.avgIncome.value}
        delta={summary.avgIncome.delta}
        deltaPct={summary.avgIncome.deltaPct}
        kind="money"
        periodLabel={summary.periodLabel}
      />
      <KpiCard
        label="Savings rate"
        value={summary.savingsRate.value}
        delta={summary.savingsRate.delta}
        deltaPct={summary.savingsRate.deltaPct}
        kind="rate"
        periodLabel={summary.periodLabel}
      />
      <KpiCard
        label="Net gain"
        value={summary.netGain.value}
        delta={summary.netGain.delta}
        deltaPct={summary.netGain.deltaPct}
        kind="money"
        periodLabel={summary.periodLabel}
      />
    </div>
  );
}
