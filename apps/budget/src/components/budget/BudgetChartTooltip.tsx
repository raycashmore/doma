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
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '13px',
        lineHeight: '1.5',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        pointerEvents: 'none'
      }}
    >
      <div className="font-medium text-gray-900">{formatDateLabel(date)}</div>
      <div className="flex items-center gap-2 text-gray-700">
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm"
          style={{ backgroundColor: 'rgb(220, 50, 50)' }}
        />
        Spend: {formatCurrency(spend)}
      </div>
      <div className="flex items-center gap-2 text-gray-700">
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm"
          style={{ backgroundColor: 'rgb(65, 105, 225)' }}
        />
        Sink or Swim: {formatCurrency(sinkOrSwim)}
      </div>
    </TooltipWithBounds>
  );
}
