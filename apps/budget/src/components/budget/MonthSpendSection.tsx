import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Trend } from './SummaryMini';
import { formatCurrency } from '@/lib/budget';

interface Props {
  credit1: number;
  credit2: number;
  credit3: number;
  categories: Array<{
    category: string;
    amount: number;
  }>;
  oneOffs: number;
  trend?: Trend | null;
}

export default function MonthSpendSection({
  credit1,
  credit2,
  credit3,
  categories,
  oneOffs,
  trend
}: Props) {
  const creditSubtotal = credit1 + credit2 + credit3;
  const total = creditSubtotal + oneOffs;

  return (
    <section className="rounded-3xl bg-warm-section-spend p-5 flex-1 min-w-0 flex flex-col gap-3">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[22px] leading-tight font-warm-display text-warm-text-primary">
            Spend
          </h3>
          <span className="text-[10px] font-bold text-warm-text-secondary">
            Card + one-offs
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[22px] leading-tight font-warm-display text-warm-text-primary">
            {formatCurrency(total)}
          </span>
          {trend ? <TrendBadge trend={trend} /> : null}
        </div>
      </header>

      <div className="rounded-2xl bg-warm-bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-bold text-warm-text-primary">
            Card spend by category
          </span>
          <span className="text-[13px] font-bold text-warm-text-primary">
            {formatCurrency(creditSubtotal)}
          </span>
        </div>
        {categories.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-sm">
            {categories.map((cat) => (
              <li key={cat.category} className="flex justify-between gap-3">
                <span className="min-w-0 text-warm-text-secondary">
                  {cat.category}
                </span>
                <span className="shrink-0 text-warm-text-primary">
                  {formatCurrency(cat.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-warm-text-secondary">
            No category data for this month.
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-warm-bg-card p-4 flex items-center justify-between text-sm">
        <span className="text-warm-text-secondary font-medium">One-offs</span>
        <span className="text-warm-text-primary">
          {formatCurrency(oneOffs)}
        </span>
      </div>
    </section>
  );
}

/** For spend, down is good (spending less) so colors are inverted. */
function TrendBadge({ trend }: { trend: Trend }) {
  const Icon =
    trend.direction === 'up'
      ? TrendingUp
      : trend.direction === 'down'
        ? TrendingDown
        : Minus;
  const color =
    trend.direction === 'down'
      ? 'text-warm-positive'
      : trend.direction === 'up'
        ? 'text-warm-accent'
        : 'text-warm-text-secondary';
  const sign = trend.pct > 0 ? '+' : '';
  const label =
    trend.direction === 'flat' ? 'Flat' : `${sign}${trend.pct.toFixed(1)}%`;
  return (
    <div className={`flex items-center gap-1 text-[10px] font-bold ${color}`}>
      <Icon size={10} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
