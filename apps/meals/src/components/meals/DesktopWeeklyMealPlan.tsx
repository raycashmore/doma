import { BriefcaseBusiness, Utensils } from 'lucide-react';
import { WEEKDAYS } from '@repo/convex/meals/model';

import { RecipeSlot } from './RecipeSlot';
import { ShoppingReview } from './ShoppingReview';
import { WeeklyMealPlannerIntro } from './WeeklyMealPlannerHeader';
import { DAY_NAMES, findAssignment, formatDate } from './weeklyMealPlannerModel';
import type { Weekday, WeeklyMealAssignment, WeeklyMealType } from '@repo/convex/meals/model';
import type { ShoppingRow } from './weeklyMealPlannerModel';

import type { RecipeView } from './types';

type DesktopWeeklyMealPlanProps = {
  assignments: Array<WeeklyMealAssignment>;
  dates: Array<string>;
  recipesById: Map<string, RecipeView>;
  shoppingRows: Array<ShoppingRow>;
  onChooseSlot: (day: Weekday, meal: WeeklyMealType) => void;
  onRemoveShoppingRow: (id: string) => void;
  onSendToLists: () => void;
  onSuggest?: () => void;
  onWeekChange: (weekDelta: number) => void;
};

export function DesktopWeeklyMealPlan({
  assignments,
  dates,
  recipesById,
  shoppingRows,
  onChooseSlot,
  onRemoveShoppingRow,
  onSendToLists,
  onSuggest,
  onWeekChange
}: DesktopWeeklyMealPlanProps) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-5">
      <div className="flex min-h-0 flex-col gap-4">
        <WeeklyMealPlannerIntro dates={dates} isDesktop onWeekChange={onWeekChange} onSuggest={onSuggest} />
        <div
          aria-label="Weekly meal plan"
          className="grid min-h-0 flex-1 grid-cols-[108px_repeat(5,minmax(0,1fr))] grid-rows-[42px_repeat(2,minmax(0,1fr))] gap-2.5"
        >
          <span />
          {WEEKDAYS.map((day, index) => (
            <div key={day} className="flex flex-col items-center justify-end pb-1">
              <span className="font-warm-display text-[15px]">{DAY_NAMES[day]}</span>
              <span className="text-[11px] text-warm-text-secondary">
                {formatDate(dates[index] ?? '', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
          <div className="flex flex-col justify-center rounded-[16px] bg-meal-butter p-3.5">
            <BriefcaseBusiness aria-hidden="true" size={20} />
            <span className="mt-2 font-warm-display text-sm leading-tight">School lunch</span>
            <span className="mt-1 text-[9px] text-warm-text-secondary">Packed for the day</span>
          </div>
          {WEEKDAYS.map((day) => {
            const assignment = findAssignment(assignments, day, 'schoolLunch');
            return (
              <RecipeSlot
                key={`${day}-schoolLunch`}
                day={day}
                meal="schoolLunch"
                recipe={assignment ? (recipesById.get(assignment.recipePublicId) ?? null) : null}
                onChoose={() => onChooseSlot(day, 'schoolLunch')}
              />
            );
          })}
          <div className="flex flex-col justify-center rounded-[16px] bg-meal-sage p-3.5">
            <Utensils aria-hidden="true" size={20} />
            <span className="mt-2 font-warm-display text-sm">Dinner</span>
            <span className="mt-1 text-[9px] text-warm-text-secondary">At home together</span>
          </div>
          {WEEKDAYS.map((day) => {
            const assignment = findAssignment(assignments, day, 'dinner');
            return (
              <RecipeSlot
                key={`${day}-dinner`}
                day={day}
                meal="dinner"
                recipe={assignment ? (recipesById.get(assignment.recipePublicId) ?? null) : null}
                onChoose={() => onChooseSlot(day, 'dinner')}
              />
            );
          })}
        </div>
      </div>
      <ShoppingReview rows={shoppingRows} onRemove={onRemoveShoppingRow} onSend={onSendToLists} />
    </div>
  );
}
