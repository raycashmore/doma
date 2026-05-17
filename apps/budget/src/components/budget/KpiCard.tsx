import { ArrowDown, ArrowUp } from 'lucide-react';
import { formatCurrency } from '@/lib/budget';

export interface KpiCardProps {
  label: string;
  /** Cents, or basis points if `kind === 'rate'`. */
  value: number;
  delta: number | null;
  deltaPct: number | null;
  kind: 'money' | 'rate';
  periodLabel: string;
}

function formatValue(value: number, kind: 'money' | 'rate'): string {
  if (kind === 'rate') {
    // basis points -> percentage with 1 decimal
    return `${(value / 100).toFixed(1)}%`;
  }
  return formatCurrency(value);
}

function formatDelta(
  delta: number | null,
  deltaPct: number | null,
  kind: 'money' | 'rate'
): string | null {
  if (delta === null) return null;
  if (kind === 'rate') {
    return `${delta >= 0 ? '+' : ''}${(delta / 100).toFixed(1)}pp`;
  }
  if (deltaPct === null) return formatCurrency(delta);
  return `${delta >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`;
}

export function KpiCard({
  label,
  value,
  delta,
  deltaPct,
  kind,
  periodLabel
}: KpiCardProps) {
  const deltaLabel = formatDelta(delta, deltaPct, kind);
  const positive = (delta ?? 0) >= 0;

  return (
    <div className="rounded-2xl border border-warm-border bg-warm-bg-card-soft px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.06em] font-semibold text-warm-text-secondary">
        {label}
      </div>
      <div className="mt-2 text-[26px] leading-none font-warm-display text-warm-text-primary">
        {formatValue(value, kind)}
      </div>
      {deltaLabel ? (
        <div
          className={`mt-2 flex items-center gap-1 text-[11px] font-medium ${
            positive ? 'text-warm-positive' : 'text-warm-negative'
          }`}
        >
          {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          <span>{deltaLabel}</span>
          <span className="text-warm-text-tertiary font-normal">
            vs prior {periodLabel}
          </span>
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-warm-text-tertiary">
          vs prior {periodLabel}
        </div>
      )}
    </div>
  );
}
