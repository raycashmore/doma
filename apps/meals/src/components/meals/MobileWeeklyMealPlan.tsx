import { ShoppingCart } from 'lucide-react';
import { WEEKDAYS, WEEKLY_MEAL_TYPES } from '@repo/convex/meals/model';

import { RecipeSlot } from './RecipeSlot';
import { WeeklyMealPlannerIntro } from './WeeklyMealPlannerHeader';
import { DAY_NAMES, findAssignment, formatDate } from './weeklyMealPlannerModel';
import type { Weekday, WeeklyMealAssignment, WeeklyMealType } from '@repo/convex/meals/model';

import type { RecipeView } from './types';
import { cn } from '@/lib/utils';

type MobileWeeklyMealPlanProps = {
  assignments: Array<WeeklyMealAssignment>;
  dates: Array<string>;
  recipesById: Map<string, RecipeView>;
  selectedDay: Weekday;
  shoppingRowCount: number;
  onChooseSlot: (day: Weekday, meal: WeeklyMealType) => void;
  onOpenCart: () => void;
  onSelectDay: (day: Weekday) => void;
  onSuggest?: () => void;
  onWeekChange: (weekDelta: number) => void;
};

export function MobileWeeklyMealPlan({
  assignments,
  dates,
  recipesById,
  selectedDay,
  shoppingRowCount,
  onChooseSlot,
  onOpenCart,
  onSelectDay,
  onSuggest,
  onWeekChange
}: MobileWeeklyMealPlanProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[13px]">
      <WeeklyMealPlannerIntro dates={dates} onWeekChange={onWeekChange} onSuggest={onSuggest} />
      <div className="grid grid-cols-5 gap-1.5">
        {WEEKDAYS.map((day, index) => {
          const selected = selectedDay === day;
          return (
            <button
              key={day}
              type="button"
              aria-label={`Select ${DAY_NAMES[day]} ${formatDate(dates[index] ?? '', { day: 'numeric', month: 'long' })}`}
              aria-pressed={selected}
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center rounded-[12px] border px-1 py-2.5',
                selected
                  ? 'border-warm-accent-soft bg-meal-peach text-warm-accent-soft'
                  : 'border-warm-border bg-warm-bg-card-soft text-warm-text-secondary'
              )}
            >
              <span className="text-[10px] font-bold">{formatDate(dates[index] ?? '', { weekday: 'short' })}</span>
              <span className="font-warm-display text-sm text-warm-text-primary">
                {formatDate(dates[index] ?? '', { day: 'numeric' })}
              </span>
            </button>
          );
        })}
      </div>
      <div aria-label="Selected day meals" className="flex min-h-[280px] flex-1 flex-col gap-2.5">
        <h3 className="sr-only">{DAY_NAMES[selectedDay]}</h3>
        {WEEKLY_MEAL_TYPES.map((meal) => {
          const assignment = findAssignment(assignments, selectedDay, meal);
          return (
            <RecipeSlot
              key={meal}
              day={selectedDay}
              meal={meal}
              recipe={assignment ? (recipesById.get(assignment.recipePublicId) ?? null) : null}
              onChoose={() => onChooseSlot(selectedDay, meal)}
              compact
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2.5 rounded-[18px] bg-warm-text-primary p-3 text-warm-bg-card-soft">
        <span className="flex size-[38px] items-center justify-center rounded-[12px] bg-warm-bg-dark-muted">
          <ShoppingCart aria-hidden="true" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold">Shopping cart</span>
          <span className="block text-[9px] text-warm-text-tertiary">
            {shoppingRowCount} items · updates with the week
          </span>
        </span>
        <button
          type="button"
          onClick={onOpenCart}
          className="rounded-full bg-warm-accent-soft px-3 py-2 text-[10px] font-bold"
        >
          Review
        </button>
      </div>
    </div>
  );
}
