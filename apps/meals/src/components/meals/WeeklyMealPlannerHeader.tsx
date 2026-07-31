import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

import { MealSectionTabs } from './MealSectionTabs';
import { formatWeekRange } from './weeklyMealPlannerModel';

type WeeklyMealPlannerHeaderProps = {
  dates: Array<string>;
  onWeekChange: (weekDelta: number) => void;
  onSuggest?: () => void;
};

function WeekNavigation({ onWeekChange }: Pick<WeeklyMealPlannerHeaderProps, 'onWeekChange'>) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous week"
        onClick={() => onWeekChange(-1)}
        className="flex size-[34px] items-center justify-center rounded-full border border-warm-border bg-warm-bg-card-soft text-warm-text-secondary"
      >
        <ChevronLeft aria-hidden="true" size={15} />
      </button>
      <button
        type="button"
        aria-label="Next week"
        onClick={() => onWeekChange(1)}
        className="flex size-[34px] items-center justify-center rounded-full border border-warm-border bg-warm-bg-card-soft text-warm-text-secondary"
      >
        <ChevronRight aria-hidden="true" size={15} />
      </button>
    </div>
  );
}

function SuggestButton({ onSuggest }: { onSuggest: () => void }) {
  return (
    <button
      type="button"
      aria-label="Suggest meals"
      onClick={onSuggest}
      className="flex items-center gap-1.5 rounded-full bg-warm-accent-soft px-3 py-2.5 text-[11px] font-bold text-warm-bg-card-soft md:gap-2 md:px-[18px] md:text-[13px]"
    >
      <Sparkles aria-hidden="true" size={15} />
      <span className="md:hidden">Suggest</span>
      <span className="hidden md:inline">Suggest meals</span>
    </button>
  );
}

export function WeeklyMealPlannerTabs({ className }: { className?: string }) {
  return <MealSectionTabs active="week" className={className} />;
}

export function DesktopWeeklyMealPlannerHeader({ dates, onWeekChange, onSuggest }: WeeklyMealPlannerHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="shrink-0">
        <h2 className="font-warm-display text-[30px] leading-tight">Week plan</h2>
        <p className="mt-0.5 text-[13px] text-warm-text-secondary">{formatWeekRange(dates)}</p>
      </div>
      <WeeklyMealPlannerTabs className="w-full max-w-64" />
      <div className="ml-auto flex items-center gap-3">
        {onSuggest ? <SuggestButton onSuggest={onSuggest} /> : null}
        <WeekNavigation onWeekChange={onWeekChange} />
      </div>
    </div>
  );
}

export function WeeklyMealPlannerIntro({ dates, onWeekChange, onSuggest }: WeeklyMealPlannerHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-warm-display text-[24px] leading-tight">Week plan</h2>
        </div>
        {onSuggest ? <SuggestButton onSuggest={onSuggest} /> : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-warm-text-secondary">{formatWeekRange(dates)}</p>
        <WeekNavigation onWeekChange={onWeekChange} />
      </div>
    </div>
  );
}
