import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/budget';

export type TrendDirection = 'up' | 'down' | 'flat';
export type Trend = { pct: number; direction: TrendDirection };

type Props = {
  label: string;
  value: number;
  fill: string;
  trend?: Trend | null;
};

export function SummaryMini({ label, value, fill, trend }: Props) {
  return (
    <div className={`${fill} rounded-2xl px-4 py-3`}>
      <div className="text-[11px] uppercase tracking-wide text-warm-text-secondary font-semibold">{label}</div>
      <div className="mt-1 text-[22px] font-warm-display text-warm-text-primary">{formatCurrency(value)}</div>
      {trend ? <TrendRow trend={trend} /> : null}
    </div>
  );
}

function TrendRow({ trend }: { trend: Trend }) {
  const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const color =
    trend.direction === 'up'
      ? 'text-warm-positive'
      : trend.direction === 'down'
        ? 'text-warm-accent'
        : 'text-warm-text-secondary';
  const sign = trend.pct > 0 ? '+' : '';
  const label = trend.direction === 'flat' ? 'Flat MoM' : `${sign}${trend.pct.toFixed(1)}% MoM`;
  return (
    <div className={`mt-1 flex items-center gap-1 whitespace-nowrap text-[11px] font-medium ${color}`}>
      <Icon size={12} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
