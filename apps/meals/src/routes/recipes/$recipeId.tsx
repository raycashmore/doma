import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@repo/convex';

import { RecipeDetail } from '@/components/meals/RecipeDetail';
import { getMealsBaseUrl } from '@/config/basePath';
import { FIXTURE_MODE } from '@/config/runtime';
import { getFixtureRecipe } from '@/lib/fixtureRecipes';

// eslint-disable-next-line turbo/no-undeclared-env-vars
const APP_BASE_URL = getMealsBaseUrl(import.meta.env.DEV);

export const Route = createFileRoute('/recipes/$recipeId')({ ssr: !FIXTURE_MODE, component: RecipeDetailRoute });

function RecipeDetailRoute() {
  const { recipeId } = Route.useParams();
  const queriedRecipe = useQuery(api.meals.queries.getRecipeByPublicId, FIXTURE_MODE ? 'skip' : { publicId: recipeId });
  const recipe = FIXTURE_MODE ? getFixtureRecipe(recipeId) : queriedRecipe;

  if (recipe === undefined)
    return <div className="h-full animate-pulse rounded-[28px] bg-warm-bg-card" aria-label="Loading meal" />;
  if (recipe === null)
    return (
      <div className="flex h-full items-center justify-center rounded-[28px] bg-warm-bg-card text-sm text-warm-text-secondary">
        Recipe unavailable.
      </div>
    );

  return <RecipeDetail recipe={recipe} baseUrl={APP_BASE_URL} />;
}
