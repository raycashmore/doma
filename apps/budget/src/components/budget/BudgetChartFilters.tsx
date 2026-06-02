import type { TimePeriod } from '@/lib/budget';
import { cn } from '@/lib/utils';

const PERIODS: Array<{ id: TimePeriod; label: string }> = [
  { id: '3M', label: '3 mo' },
  { id: '6M', label: '6 mo' },
  { id: '12M', label: '12 mo' },
  { id: 'ALL', label: 'All' }
];

type BudgetChartFiltersProps = {
  selected: TimePeriod;
  onChange: (period: TimePeriod) => void;
};

export default function BudgetChartFilters({ selected, onChange }: BudgetChartFiltersProps) {
  return (
    <div role="tablist" className="inline-flex rounded-full border border-white/10 bg-white/8 p-1 backdrop-blur-sm">
      {PERIODS.map((p) => {
        const active = selected === p.id;
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p.id)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap',
              active ? 'bg-white/14 text-warm-text-on-dark' : 'text-white/72 hover:text-warm-text-on-dark'
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
