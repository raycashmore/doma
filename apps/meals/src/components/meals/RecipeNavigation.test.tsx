import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter
} from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecipeDetail } from './RecipeDetail';
import { RecipeForm } from './RecipeForm';

beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function createRecipeRouter(initialEntry: string) {
  const rootRoute = createRootRoute();
  const collectionRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/recipes',
    component: () => <p>Recipe collection</p>
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/recipes/$recipeId',
    component: () => (
      <RecipeDetail
        recipe={{
          publicId: 'recipe_tray',
          name: 'Chicken tray bake',
          description: 'A dependable dinner.',
          preparationTime: '40 min',
          servingsLabel: 'Serves 4',
          mealSuitabilityTags: ['Dinner'],
          ingredientLines: ['4 chicken thighs'],
          instructions: 'Roast until cooked.'
        }}
      />
    )
  });
  const createRouteForm = createRoute({
    getParentRoute: () => rootRoute,
    path: '/recipes/new',
    component: () => <RecipeForm mode="create" onSubmit={vi.fn()} />
  });
  const editRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/recipes/$recipeId/edit',
    component: () => <p>Edit recipe</p>
  });
  const weekRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/week',
    component: () => <p>Week plan</p>
  });

  return createRouter({
    routeTree: rootRoute.addChildren([collectionRoute, detailRoute, createRouteForm, editRoute, weekRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] })
  });
}

describe('recipe collection navigation', () => {
  it('returns from recipe details to the collection', async () => {
    const router = createRecipeRouter('/recipes/recipe_tray');
    await router.load();
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes'));
    expect(screen.getByText('Recipe collection')).toBeDefined();
  });

  it('cancels new recipe creation back to the collection', async () => {
    const router = createRecipeRouter('/recipes/new');
    await router.load();
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes'));
    expect(screen.getByText('Recipe collection')).toBeDefined();
  });
});
