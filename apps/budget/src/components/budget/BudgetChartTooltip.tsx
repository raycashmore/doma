import { TooltipWithBounds } from '@visx/tooltip';
import { formatCurrency } from '@/lib/budget';

interface BudgetChartTooltipProps {
  date: number;
  spend: number; // discretionary
  sinkOrSwim: number; // income proxy
  mortgage: number;
  top: number;
  left: number;
}

function monthYear(date: number) {
  return new Date(date).toLocaleString('en-AU', {
    month: 'short',
    year: 'numeric'
  });
}

export default function BudgetChartTooltip({
  date,
  spend,
  sinkOrSwim,
  mortgage,
  top,
  left
}: BudgetChartTooltipProps) {
  return (
    <TooltipWithBounds
      top={top}
      left={left}
      style={{
        position: 'absolute',
        backgroundColor: '#FFFCF6',
        border: '1px solid #3D2E2220',
        borderRadius: '12px',
        padding: '10px 12px',
        fontSize: '11px',
        lineHeight: '1.5',
        boxShadow: '0 10px 24px rgba(61,46,34,0.18)',
        pointerEvents: 'none',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        color: '#3D2E22'
      }}
    >
      <div className="font-bold text-[12px] mb-1">{monthYear(date)}</div>
      <div
        className="flex items-center justify-between gap-3 font-semibold"
        style={{ color: '#5F9466' }}
      >
        <span>Income</span>
        <span>{formatCurrency(sinkOrSwim)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 font-semibold">
        <span>Mortgage</span>
        <span>{formatCurrency(mortgage)}</span>
      </div>
      <div
        className="flex items-center justify-between gap-3 font-semibold"
        style={{ color: '#D85A36' }}
      >
        <span>Spend</span>
        <span>{formatCurrency(spend)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 font-semibold text-warm-text-secondary">
        <span>Total spend</span>
        <span>{formatCurrency(spend + mortgage)}</span>
      </div>
    </TooltipWithBounds>
  );
}
