import { useRouterState } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@repo/convex';

import { RecipeCollection } from './RecipeCollection';
import { WeekRoute } from './WeekRoute';
import { FIXTURE_MODE } from '@/config/runtime';
import { listFixtureRecipes } from '@/lib/fixtureRecipes';

export function MealsTabsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeTab = pathname === '/week' ? 'week' : 'meals';

  return (
    <>
      <div hidden={activeTab !== 'week'} className="h-full">
        <WeekRoute />
      </div>
      <div hidden={activeTab !== 'meals'} className="h-full">
        <MealsCollectionPanel />
      </div>
    </>
  );
}

function MealsCollectionPanel() {
  if (FIXTURE_MODE) {
    return <RecipeCollection recipes={listFixtureRecipes()} />;
  }

  return <ConvexMealsCollectionPanel />;
}

function ConvexMealsCollectionPanel() {
  const recipes = useQuery(api.meals.queries.listRecipes, {});

  if (recipes === undefined) {
    return <div className="h-full rounded-[28px] bg-warm-bg-card" aria-label="Loading meals" />;
  }

  return <RecipeCollection recipes={recipes} />;
}
