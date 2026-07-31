import { ArrowLeft, Clock3, Pencil, Utensils } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { MealSectionTabs } from './MealSectionTabs';
import type { RecipeView } from './types';

export function RecipeDetail({ recipe }: { recipe: RecipeView }) {
  return (
    <section className="flex min-h-full flex-col gap-4 rounded-t-[24px] bg-warm-bg-card p-4 md:h-full md:min-h-0 md:rounded-[28px] md:p-6">
      <div className="flex items-center justify-between gap-3">
        <MealSectionTabs />
        <div className="flex items-center gap-2">
          <Link
            to="/recipes"
            className="hidden rounded-full border border-warm-border px-3.5 py-2 text-xs font-semibold text-warm-text-secondary md:flex md:items-center md:gap-1.5"
          >
            <ArrowLeft aria-hidden="true" size={14} /> Back
          </Link>
          <Link
            to="/recipes/$recipeId/edit"
            params={{ recipeId: recipe.publicId }}
            className="flex items-center gap-1.5 rounded-full bg-warm-text-primary px-3.5 py-2 text-xs font-bold text-warm-bg-card-soft"
          >
            <Pencil aria-hidden="true" size={13} /> Edit
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto md:grid-cols-[minmax(0,1fr)_minmax(280px,0.38fr)] md:grid-rows-[auto_1fr] md:overflow-hidden">
        <article className="min-w-0">
          <header className="rounded-[18px] bg-meal-sage p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-warm-positive">Household recipe</p>
                <h2 className="mt-1 font-warm-display text-2xl md:text-[28px]">{recipe.name}</h2>
                <p className="mt-1 text-xs text-warm-text-secondary">{recipe.description}</p>
              </div>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-warm-bg-card">
                <Utensils aria-hidden="true" className="text-warm-positive" size={21} />
              </span>
            </div>
          </header>

          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-warm-text-secondary">
            {recipe.preparationTime ? (
              <span className="flex items-center gap-1 rounded-full bg-meal-butter px-2.5 py-1.5">
                <Clock3 aria-hidden="true" size={12} />
                {recipe.preparationTime}
              </span>
            ) : null}
            {recipe.servingsLabel ? (
              <span className="rounded-full bg-meal-sand px-2.5 py-1.5">{recipe.servingsLabel}</span>
            ) : null}
            {recipe.mealSuitabilityTags.map((tag) => (
              <span key={tag} className="rounded-full bg-meal-peach px-2.5 py-1.5">
                {tag}
              </span>
            ))}
          </div>
        </article>

        <aside className="rounded-[18px] border border-warm-border bg-warm-bg-card-soft p-4 md:col-start-2 md:row-span-2 md:row-start-1 md:min-h-0 md:overflow-y-auto md:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-warm-display text-xl">Ingredients</h3>
            <span className="rounded-full bg-meal-butter px-2 py-1 text-[10px] text-warm-text-secondary">
              Fixed amounts
            </span>
          </div>
          <ul className="mt-3 divide-y divide-warm-border text-sm">
            {recipe.ingredientLines.map((line, index) => (
              <li key={`${index}-${line}`} className="py-3">
                {line}
              </li>
            ))}
          </ul>
        </aside>

        <section className="min-w-0 md:col-start-1 md:row-start-2 md:overflow-y-auto">
          <h3 className="font-warm-display text-xl">Instructions</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-warm-text-primary">{recipe.instructions}</p>
        </section>
      </div>
    </section>
  );
}
