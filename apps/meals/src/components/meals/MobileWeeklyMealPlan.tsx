import { ChevronRight, ShoppingCart } from 'lucide-react';
import { WEEKDAYS, WEEKLY_MEAL_TYPES } from '@repo/convex/meals/model';

import { RecipeSlot } from './RecipeSlot';
import { WeeklyMealPlannerIntro } from './WeeklyMealPlannerHeader';
import { DAY_NAMES, MEAL_NAMES, findAssignment, formatDate } from './weeklyMealPlannerModel';
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
  const selectedDayIndex = WEEKDAYS.indexOf(selectedDay);
  const nextDay = selectedDay === 'friday' ? undefined : WEEKDAYS[selectedDayIndex + 1];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[13px]">
      <WeeklyMealPlannerIntro dates={dates} isDesktop={false} onWeekChange={onWeekChange} onSuggest={onSuggest} />
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
                'flex flex-col items-center rounded-[12px] border px-1 py-2',
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
      <div aria-label="Selected day meals" className="flex flex-col gap-2.5">
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
      {nextDay ? (
        <button
          type="button"
          aria-label={`Preview ${DAY_NAMES[nextDay]}`}
          onClick={() => onSelectDay(nextDay)}
          className="flex items-center gap-3 rounded-[16px] bg-meal-sand p-3 text-left"
        >
          <span className="w-10 text-center font-warm-display text-xs uppercase leading-tight">
            {formatDate(dates[selectedDayIndex + 1] ?? '', { weekday: 'short' })}
            <br />
            {formatDate(dates[selectedDayIndex + 1] ?? '', { day: 'numeric' })}
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            {WEEKLY_MEAL_TYPES.map((meal) => {
              const assignment = findAssignment(assignments, nextDay, meal);
              const recipe = assignment ? recipesById.get(assignment.recipePublicId) : undefined;
              return (
                <span key={meal} className="flex min-w-0 items-baseline gap-1.5">
                  <span className="w-[70px] shrink-0 text-[8px] font-bold uppercase text-warm-text-secondary">
                    {MEAL_NAMES[meal]}
                  </span>
                  <span className="truncate text-[10px] font-semibold text-warm-text-primary">
                    {recipe?.name ?? 'No meal planned'}
                  </span>
                </span>
              );
            })}
          </span>
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      ) : null}
      <div className="min-h-2 flex-1" />
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
