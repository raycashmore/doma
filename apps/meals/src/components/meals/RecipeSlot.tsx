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
          ? 'min-h-[132px] flex-1 overflow-hidden rounded-[16px] border border-warm-border bg-warm-bg-card-soft'
          : 'h-full flex-col gap-2 rounded-[16px] border border-warm-border bg-warm-bg-card-soft p-3.5'
      )}
    >
      {compact ? (
        <>
          <span
            className={cn(
              'flex w-[76px] shrink-0 flex-col items-center justify-center gap-2 self-stretch px-2 text-center',
              meal === 'schoolLunch' ? 'bg-meal-butter' : 'bg-meal-sage'
            )}
          >
            {meal === 'schoolLunch' ? (
              <BriefcaseBusiness aria-hidden="true" size={21} />
            ) : (
              <Utensils aria-hidden="true" size={21} />
            )}
            <span className="text-[10px] font-bold capitalize leading-tight text-warm-text-secondary">
              {MEAL_NAMES[meal]}
            </span>
          </span>
          <span className="flex min-w-0 flex-1 items-center px-4 py-5">
            {recipe ? (
              <>
                <span className="min-w-0 flex-1 text-left">{recipeDetails}</span>
                <Ellipsis aria-hidden="true" className="ml-3 shrink-0 text-warm-text-secondary" size={17} />
              </>
            ) : (
              <span className="flex w-full items-center justify-center gap-2.5 text-xs font-semibold text-warm-text-tertiary">
                {addMeal}
              </span>
            )}
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
