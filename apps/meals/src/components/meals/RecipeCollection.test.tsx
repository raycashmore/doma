import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter
} from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecipeCollection } from './RecipeCollection';

const recipes = [
  {
    publicId: 'recipe_wraps',
    name: 'Veggie wraps',
    description: 'A quick school lunch.',
    preparationTime: '20 min',
    servingsLabel: 'Serves 4',
    mealSuitabilityTags: ['School lunch', 'Quick'],
    ingredientLines: ['4 wraps'],
    instructions: 'Fill and roll.'
  },
  {
    publicId: 'recipe_tray',
    name: 'Chicken tray bake',
    description: 'A dependable dinner.',
    preparationTime: '40 min',
    servingsLabel: 'Serves 4–6',
    mealSuitabilityTags: ['Dinner', 'Favourite'],
    ingredientLines: ['4 chicken thighs'],
    instructions: 'Roast until cooked.'
  }
];

function createCollectionRouter(collectionRecipes: typeof recipes) {
  const rootRoute = createRootRoute({ component: Outlet });
  const collectionRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <RecipeCollection recipes={collectionRecipes} />
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/recipes/$recipeId',
    component: () => <p>Recipe detail</p>
  });
  return createRouter({
    routeTree: rootRoute.addChildren([collectionRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] })
  });
}

beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RecipeCollection', () => {
  it('shows a clear empty state with a create action', async () => {
    const router = createCollectionRouter([]);
    await router.load();
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Your repertoire starts here')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Add your first meal' }).getAttribute('href')).toBe('/recipes/new');
  });

  it('filters recipes by search and suitability', async () => {
    const router = createCollectionRouter(recipes);
    await router.load();
    render(<RouterProvider router={router} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search your meals' }), {
      target: { value: 'chicken' }
    });
    expect(screen.getByText('Chicken tray bake')).toBeDefined();
    expect(screen.queryByText('Veggie wraps')).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search your meals' }), {
      target: { value: '' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'School lunch' }));
    expect(screen.getByText('Veggie wraps')).toBeDefined();
    expect(screen.queryByText('Chicken tray bake')).toBeNull();
  });

  it('navigates to recipe details without a document reload', async () => {
    const router = createCollectionRouter(recipes);
    await router.load();
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole('link', { name: /Veggie wraps/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/recipe_wraps'));
    expect(screen.getByText('Recipe detail')).toBeDefined();
  });
});
