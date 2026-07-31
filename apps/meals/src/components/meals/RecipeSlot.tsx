import { BriefcaseBusiness, Ellipsis, Plus, Utensils } from 'lucide-react';

import { DAY_NAMES, MEAL_NAMES } from './weeklyMealPlannerModel';
import type { SlotSelection } from './weeklyMealPlannerModel';

import type { RecipeView } from './types';
import { cn } from '@/lib/utils';

type RecipeSlotProps = SlotSelection & {
  recipe: RecipeView | null;
  onChoose: () => void;
  compact?: boolean;
};

export function RecipeSlot({ day, meal, recipe, onChoose, compact = false }: RecipeSlotProps) {
  const label = `${recipe ? 'Change' : 'Choose'} ${DAY_NAMES[day]} ${MEAL_NAMES[meal]}`;
  const addMeal = (
    <>
      <Plus aria-hidden="true" className="rounded-full bg-meal-peach p-1 text-warm-accent-soft" size={24} />
      Add meal
    </>
  );
  const recipeDetails = recipe ? (
    <>
      <span
        className={cn(
          'block truncate font-warm-display text-[15px] leading-tight md:text-[16px]',
          !compact && 'mt-0.5'
        )}
      >
        {recipe.name}
      </span>
      <span className="mt-1 block truncate text-[9px] text-warm-text-secondary md:text-[10px]">
        {recipe.ingredientLines.slice(0, 3).join(', ')}
      </span>
      {!compact && recipe.mealSuitabilityTags.length ? (
        <span className="mt-auto inline-flex rounded-full bg-meal-sand px-2 py-1 text-[8px] font-semibold text-warm-text-secondary">
          {recipe.mealSuitabilityTags[0]}
        </span>
      ) : null}
    </>
  ) : null;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onChoose}
      className={cn(
        'group flex w-full min-w-0 text-left transition-colors hover:border-warm-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent-soft',
        compact
          ? 'min-h-[132px] flex-1 flex-col items-stretch gap-3 rounded-[16px] border border-warm-border bg-warm-bg-card-soft p-4'
          : 'h-full flex-col gap-2 rounded-[16px] border border-warm-border bg-warm-bg-card-soft p-3.5'
      )}
    >
      {compact ? (
        <>
          <span className="flex w-full items-center justify-between gap-3">
            <span className="text-[9px] font-bold capitalize text-warm-text-secondary">{MEAL_NAMES[meal]}</span>
            {recipe ? <Ellipsis aria-hidden="true" className="shrink-0 text-warm-text-secondary" size={17} /> : null}
          </span>
          <span className="flex min-h-0 flex-1 items-center gap-3">
            <span
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-[13px]',
                meal === 'schoolLunch' ? 'bg-meal-butter' : 'bg-meal-sage'
              )}
            >
              {meal === 'schoolLunch' ? (
                <BriefcaseBusiness aria-hidden="true" size={19} />
              ) : (
                <Utensils aria-hidden="true" size={19} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              {recipeDetails ?? (
                <span className="flex items-center gap-2 text-[10px] font-semibold text-warm-text-tertiary">
                  {addMeal}
                </span>
              )}
            </span>
          </span>
        </>
      ) : (
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-bold capitalize text-warm-text-secondary">{MEAL_NAMES[meal]}</span>
          {recipeDetails ?? (
            <span className="flex h-full min-h-16 flex-col items-center justify-center gap-2 text-[10px] font-semibold text-warm-text-tertiary">
              {addMeal}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
