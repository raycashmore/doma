import type { TimePeriod } from '@/lib/budget';
import { cn } from '@/lib/utils';

const PERIODS: Array<{ id: TimePeriod; label: string }> = [
  { id: '3M', label: '3 mo' },
  { id: '6M', label: '6 mo' },
  { id: '12M', label: '12 mo' },
  { id: 'ALL', label: 'All' }
];

interface BudgetChartFiltersProps {
  selected: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

export default function BudgetChartFilters({
  selected,
  onChange
}: BudgetChartFiltersProps) {
  return (
    <div
      role="tablist"
      className="inline-flex rounded-full bg-warm-bg-card-soft p-1"
    >
      {PERIODS.map((p) => {
        const active = selected === p.id;
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p.id)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors',
              active
                ? 'bg-warm-bg-dark text-warm-text-on-dark'
                : 'text-warm-text-secondary hover:text-warm-text-primary'
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
