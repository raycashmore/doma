import { useState } from 'react';
import { ChefHat, ChevronRight, Clock3, Plus, Search, Utensils } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { MealSectionTabs } from './MealSectionTabs';
import type { RecipeView } from './types';
import { cn } from '@/lib/utils';

const FILTERS = ['All meals', 'School lunch', 'Dinner', 'Quick', 'Favourite'] as const;
const CARD_TONES = ['bg-meal-butter', 'bg-meal-sage', 'bg-meal-sky', 'bg-meal-lavender', 'bg-meal-peach'];

export function RecipeCollection({ recipes }: { recipes: Array<RecipeView> }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All meals');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesQuery =
      !normalizedQuery ||
      recipe.name.toLocaleLowerCase().includes(normalizedQuery) ||
      recipe.description.toLocaleLowerCase().includes(normalizedQuery);
    const matchesFilter = filter === 'All meals' || recipe.mealSuitabilityTags.includes(filter);
    return matchesQuery && matchesFilter;
  });

  return (
    <section className="flex min-h-full flex-col gap-4 rounded-t-[24px] bg-warm-bg-card p-4 md:h-full md:min-h-0 md:gap-5 md:rounded-[28px] md:p-6">
      <MealSectionTabs className="max-w-none" />

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-warm-display text-[23px] leading-tight md:text-[28px]">Repertoire</h2>
          <Link
            to="/recipes/new"
            className="flex items-center justify-center gap-2 rounded-full bg-warm-text-primary p-2.5 text-xs font-bold text-warm-bg-card-soft md:px-4"
          >
            <Plus aria-hidden="true" size={16} />
            <span className="hidden md:inline">Add meal</span>
            <span className="sr-only md:hidden">Add meal</span>
          </Link>
        </div>
        <label className="flex items-center gap-2 rounded-full border border-warm-border bg-warm-bg-card-soft px-3.5 py-2.5 md:w-72">
          <Search aria-hidden="true" className="text-warm-text-tertiary" size={15} />
          <span className="sr-only">Search your meals</span>
          <input
            type="search"
            aria-label="Search your meals"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your meals"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-warm-text-tertiary"
          />
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Meal filters">
        {FILTERS.map((option) => {
          const active = filter === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold md:text-xs',
                active
                  ? 'border-warm-text-primary bg-warm-text-primary text-warm-bg-card-soft'
                  : 'border-warm-border bg-warm-bg-card-soft text-warm-text-secondary'
              )}
            >
              {option === 'All meals' ? 'All' : option}
              <span className="sr-only">{option === 'All meals' ? ' meals' : ''}</span>
            </button>
          );
        })}
      </div>

      {recipes.length === 0 ? (
        <div className="flex min-h-72 flex-1 flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-warm-border bg-warm-bg-card-soft p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-meal-butter">
            <ChefHat aria-hidden="true" size={22} />
          </span>
          <div>
            <h3 className="font-warm-display text-xl">Your repertoire starts here</h3>
            <p className="mt-1 max-w-sm text-sm text-warm-text-secondary">
              Add an approved household recipe to begin your cookbook.
            </p>
          </div>
          <Link
            to="/recipes/new"
            className="rounded-full bg-warm-text-primary px-4 py-2.5 text-xs font-bold text-warm-bg-card-soft"
          >
            Add your first meal
          </Link>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="flex min-h-48 flex-1 items-center justify-center rounded-[20px] border border-dashed border-warm-border text-center text-sm text-warm-text-secondary">
          No meals match this search.
        </div>
      ) : (
        <div className="grid content-start gap-2.5 overflow-y-auto md:grid-cols-2 lg:grid-cols-3 md:gap-3">
          {filteredRecipes.map((recipe, index) => (
            <Link
              key={recipe.publicId}
              to="/recipes/$recipeId"
              params={{ recipeId: recipe.publicId }}
              className="group flex items-center gap-3 rounded-[14px] border border-warm-border bg-warm-bg-card-soft p-2.5 transition-transform hover:-translate-y-0.5 md:flex-col md:items-stretch md:gap-3 md:rounded-[18px] md:p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    CARD_TONES[index % CARD_TONES.length]
                  )}
                >
                  <Utensils aria-hidden="true" size={18} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-warm-display text-base md:text-lg">{recipe.name}</h3>
                <p className="hidden truncate text-[10px] text-warm-text-secondary md:block md:text-xs">
                  {recipe.description}
                </p>
                <p className="truncate text-[10px] text-warm-text-secondary md:hidden">
                  {[recipe.preparationTime, recipe.mealSuitabilityTags[0]].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-2 hidden flex-wrap items-center gap-1.5 text-[10px] text-warm-text-secondary md:flex">
                  {recipe.preparationTime ? (
                    <span className="flex items-center gap-1">
                      <Clock3 aria-hidden="true" size={11} />
                      {recipe.preparationTime}
                    </span>
                  ) : null}
                  {recipe.mealSuitabilityTags.slice(0, 2).map((tag) => (
                    <span key={tag} className="rounded-full bg-meal-sand px-2 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight aria-hidden="true" className="shrink-0 text-warm-text-tertiary md:hidden" size={16} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
