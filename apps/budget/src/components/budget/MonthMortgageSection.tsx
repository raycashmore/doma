import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { Trend } from './SummaryMini';
import { formatCurrency } from '@/lib/budget';

interface Props {
  contribTotal: number;
  fixedPayment: number;
  variablePayment: number;
  paymentTotal: number;
  offset1: number;
  offset2: number;
  debt1: number;
  debt2: number;
  trend?: Trend | null;
}

export default function MonthMortgageSection({
  contribTotal: _contribTotal,
  fixedPayment,
  variablePayment,
  paymentTotal,
  offset1,
  offset2,
  debt1,
  debt2,
  trend
}: Props) {
  return (
    <section className="rounded-3xl bg-warm-section-mortgage p-5 flex-1 min-w-0 flex flex-col gap-3">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[22px] leading-tight font-warm-display text-warm-text-primary">
            Mortgage
          </h3>
          <span className="text-[10px] font-bold text-warm-text-secondary">
            Payment split
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[22px] leading-tight font-warm-display text-warm-text-primary">
            {formatCurrency(fixedPayment + variablePayment)}
          </span>
          {trend ? <TrendBadge trend={trend} /> : null}
        </div>
      </header>

      <div className="rounded-2xl bg-warm-bg-card p-4">
        <h4 className="text-[13px] font-bold text-warm-text-primary mb-2">
          Payment split
        </h4>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Fixed payment</span>
            <span className="text-warm-text-primary">
              {formatCurrency(fixedPayment)}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Variable payment</span>
            <span className="text-warm-text-primary">
              {formatCurrency(variablePayment)}
            </span>
          </li>
          <li className="flex justify-between font-medium">
            <span className="text-warm-text-primary">Total payment</span>
            <span className="text-warm-text-primary">
              {formatCurrency(paymentTotal)}
            </span>
          </li>
        </ul>
      </div>

      <div className="rounded-2xl bg-warm-bg-card p-4">
        <h4 className="text-[13px] font-bold text-warm-text-primary mb-2">
          Debt and equity context
        </h4>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Offset 1</span>
            <span className="text-warm-text-primary">
              {formatCurrency(offset1)}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Offset 2</span>
            <span className="text-warm-text-primary">
              {formatCurrency(offset2)}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Debt 1</span>
            <span className="text-warm-text-primary">
              {formatCurrency(debt1)}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Debt 2</span>
            <span className="text-warm-text-primary">
              {formatCurrency(debt2)}
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
    trend.direction === 'flat'
      ? 'Flat'
      : `${sign}${trend.pct.toFixed(1)}%`;
  return (
    <div
      className={`flex items-center gap-1 text-[10px] font-bold ${color}`}
    >
      <Icon size={10} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
