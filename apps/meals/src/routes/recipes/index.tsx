import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@repo/convex';

import { RecipeCollection } from '@/components/meals/RecipeCollection';
import { FIXTURE_MODE } from '@/config/runtime';
import { listFixtureRecipes } from '@/lib/fixtureRecipes';

export const Route = createFileRoute('/recipes/')({
  ssr: !FIXTURE_MODE,
  component: MealsCollectionRoute
});

function MealsCollectionRoute() {
  const recipes = useQuery(api.meals.queries.listRecipes, FIXTURE_MODE ? 'skip' : {});
  const visibleRecipes = FIXTURE_MODE ? listFixtureRecipes() : recipes;

  if (visibleRecipes === undefined) {
    return <div className="h-full rounded-[28px] bg-warm-bg-card" aria-label="Loading meals" />;
  }

  return <RecipeCollection recipes={visibleRecipes} />;
}
