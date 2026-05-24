import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Trend } from './SummaryMini';
import { formatCurrency } from '@/lib/budget';

interface Props {
  primary: number;
  secondary: number;
  billContrib: number;
  trend?: Trend | null;
}

export default function MonthIncomeSection({
  primary,
  secondary,
  billContrib,
  trend
}: Props) {
  return (
    <section className="rounded-3xl bg-warm-section-income p-5 flex-1 min-w-0 flex flex-col gap-3">
      <header className="flex items-start justify-between">
        <div>
          <h3 className="text-[22px] leading-tight font-warm-display text-warm-text-primary">
            Income
          </h3>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[22px] leading-tight font-warm-display text-warm-text-primary">
            {formatCurrency(primary + secondary + billContrib)}
          </span>
          {trend ? <TrendBadge trend={trend} /> : null}
        </div>
      </header>
      <div className="rounded-2xl bg-warm-bg-card p-4">
        <h4 className="text-[13px] font-bold text-warm-text-primary mb-2">
          Income contributors
        </h4>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Primary</span>
            <span className="text-warm-text-primary">
              {formatCurrency(primary)}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Secondary</span>
            <span className="text-warm-text-primary">
              {formatCurrency(secondary)}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Bill contributions</span>
            <span className="text-warm-text-primary">
              {formatCurrency(billContrib)}
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  const Icon =
    trend.direction === 'up'
      ? TrendingUp
      : trend.direction === 'down'
        ? TrendingDown
        : Minus;
  const color =
    trend.direction === 'up'
      ? 'text-warm-positive'
      : trend.direction === 'down'
        ? 'text-warm-accent'
        : 'text-warm-text-secondary';
  const sign = trend.pct > 0 ? '+' : '';
  const label =
    trend.direction === 'flat' ? 'Flat' : `${sign}${trend.pct.toFixed(1)}%`;
  return (
    <div className={`flex items-center gap-1 text-[12px] font-bold ${color}`}>
      <Icon size={12} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
