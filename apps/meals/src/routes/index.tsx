import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@repo/convex';

import { RecipeCollection } from '@/components/meals/RecipeCollection';
import { getMealsBaseUrl } from '@/config/basePath';
import { listFixtureRecipes } from '@/lib/fixtureRecipes';

const FIXTURE_MODE = !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
// eslint-disable-next-line turbo/no-undeclared-env-vars
const APP_BASE_URL = getMealsBaseUrl(import.meta.env.DEV);

export const Route = createFileRoute('/')({
  ssr: !FIXTURE_MODE,
  component: MealsCollectionRoute
});

function MealsCollectionRoute() {
  const recipes = useQuery(api.meals.queries.listRecipes, FIXTURE_MODE ? 'skip' : {});
  const visibleRecipes = FIXTURE_MODE ? listFixtureRecipes() : recipes;

  if (visibleRecipes === undefined) {
    return <div className="h-full animate-pulse rounded-[28px] bg-warm-bg-card" aria-label="Loading meals" />;
  }

  return <RecipeCollection recipes={visibleRecipes} baseUrl={APP_BASE_URL} />;
}
