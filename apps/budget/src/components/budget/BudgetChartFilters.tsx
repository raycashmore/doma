import type { TimePeriod } from '@/lib/budget';
import { cn } from '@/lib/utils';

const periods: Array<TimePeriod> = ['1Y', '3Y', '5Y', 'ALL'];

interface BudgetChartFiltersProps {
  selected: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

export default function BudgetChartFilters({
  selected,
  onChange
}: BudgetChartFiltersProps) {
  return (
    <div className="flex gap-1">
      {periods.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            'px-3 py-1 text-sm font-medium rounded transition-colors',
            selected === p
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
