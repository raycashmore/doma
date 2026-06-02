import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Trend } from './SummaryMini';
import { formatCurrency } from '@/lib/budget';

const CATEGORY_PREVIEW_LIMIT = 10;

type Props = {
  credit1: number;
  credit2: number;
  credit3: number;
  categories: Array<{
    category: string;
    amount: number;
  }>;
  oneOffs: number;
  trend?: Trend | null;
};

export default function MonthSpendSection({ credit1, credit2, credit3, categories, oneOffs, trend }: Props) {
  const [expanded, setExpanded] = useState(false);
  const creditCardPrimary = credit1 + credit3;
  const total = creditCardPrimary + credit2 + oneOffs;
  const hasOverflowCategories = categories.length > CATEGORY_PREVIEW_LIMIT;
  const visibleCategories =
    expanded || !hasOverflowCategories ? categories : categories.slice(0, CATEGORY_PREVIEW_LIMIT);
  const ExpandIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <section className="rounded-3xl bg-warm-section-spend p-5 flex-1 min-w-0 flex flex-col gap-3">
      <header className="flex items-start justify-between">
        <div>
          <h3 className="text-[22px] leading-tight font-warm-display text-warm-text-primary">Spend</h3>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[22px] leading-tight font-warm-display text-warm-text-primary">
            {formatCurrency(total)}
          </span>
          {trend ? <TrendBadge trend={trend} /> : null}
        </div>
      </header>

      <div className="rounded-2xl bg-warm-bg-card p-4">
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex justify-between gap-3">
            <span className="min-w-0 break-words text-warm-text-secondary [overflow-wrap:anywhere]">
              Credit card primary
            </span>
            <span className="shrink-0 text-warm-text-primary">{formatCurrency(creditCardPrimary)}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="min-w-0 break-words text-warm-text-secondary [overflow-wrap:anywhere]">
              Credit card secondary
            </span>
            <span className="shrink-0 text-warm-text-primary">{formatCurrency(credit2)}</span>
          </li>
        </ul>
      </div>

      <div className="rounded-2xl bg-warm-bg-card p-4">
        {categories.length > 0 ? (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-1.5 text-sm">
              {visibleCategories.map((cat) => (
                <li key={cat.category} className="flex justify-between gap-3">
                  <span className="min-w-0 break-words text-warm-text-secondary [overflow-wrap:anywhere]">
                    {cat.category}
                  </span>
                  <span className="shrink-0 text-warm-text-primary">{formatCurrency(cat.amount)}</span>
                </li>
              ))}
            </ul>
            {hasOverflowCategories ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-label={expanded ? 'Show fewer spending categories' : 'Show all spending categories'}
                aria-expanded={expanded}
                className="inline-flex w-fit self-center items-center gap-1 rounded-full border border-warm-border bg-warm-bg-card-soft px-3 py-1.5 text-xs font-bold text-warm-text-secondary hover:text-warm-text-primary"
              >
                <ExpandIcon size={14} aria-hidden />
                <span>{expanded ? 'Show less' : `Show ${categories.length - CATEGORY_PREVIEW_LIMIT} more`}</span>
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-warm-text-secondary">No category data for this month.</p>
        )}
      </div>

      <div className="rounded-2xl bg-warm-bg-card p-4 flex items-center justify-between text-sm">
        <span className="text-warm-text-secondary font-medium">One-offs</span>
        <span className="text-warm-text-primary">{formatCurrency(oneOffs)}</span>
      </div>
    </section>
  );
}

/** For spend, down is good (spending less) so colors are inverted. */
function TrendBadge({ trend }: { trend: Trend }) {
  const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const color =
    trend.direction === 'down'
      ? 'text-warm-positive'
      : trend.direction === 'up'
        ? 'text-warm-accent'
        : 'text-warm-text-secondary';
  const sign = trend.pct > 0 ? '+' : '';
  const label = trend.direction === 'flat' ? 'Flat' : `${sign}${trend.pct.toFixed(1)}%`;
  return (
    <div className={`flex items-center gap-1 text-[12px] font-bold ${color}`}>
      <Icon size={12} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
