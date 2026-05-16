import { TooltipWithBounds } from '@visx/tooltip';
import { formatCurrency, formatDateLabel } from '@/lib/budget';

interface BudgetChartTooltipProps {
  date: number;
  spend: number;
  sinkOrSwim: number;
  top: number;
  left: number;
}

export default function BudgetChartTooltip({
  date,
  spend,
  sinkOrSwim,
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
        border: '1px solid #EFE3D2',
        borderRadius: '12px',
        padding: '10px 14px',
        fontSize: '12px',
        lineHeight: '1.55',
        boxShadow: '0 12px 32px rgba(61,46,34,0.16)',
        pointerEvents: 'none',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        color: '#3D2E22'
      }}
    >
      <div className="font-semibold">{formatDateLabel(date)}</div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm"
          style={{ backgroundColor: '#D85A36' }}
        />
        Spend: {formatCurrency(spend)}
      </div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm"
          style={{ backgroundColor: '#5F9466' }}
        />
        Sink or Swim: {formatCurrency(sinkOrSwim)}
      </div>
    </TooltipWithBounds>
  );
}
