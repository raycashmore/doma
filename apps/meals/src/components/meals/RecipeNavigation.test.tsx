import { RouterContextProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecipeDetail } from './RecipeDetail';
import { RecipeForm } from './RecipeForm';

import { routeTree } from '@/routeTree.gen';

beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function createRecipeRouter(initialEntry: string) {
  return createRouter({
    routeTree,
    basepath: '/meals',
    history: createMemoryHistory({ initialEntries: [initialEntry] })
  });
}

describe('recipe collection navigation', () => {
  it('returns from recipe details to the collection', async () => {
    const router = createRecipeRouter('/meals/recipes/recipe_tray');
    await router.load();
    expect(router.state.location.pathname).toBe('/recipes/recipe_tray');
    expect(router.state.matches.at(-1)?.routeId).toBe('/recipes/$recipeId');

    render(
      <RouterContextProvider router={router}>
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
      </RouterContextProvider>
    );

    const backLink = screen.getByRole('link', { name: 'Back' });
    expect(backLink.getAttribute('href')).toBe('/meals/recipes');
    fireEvent.click(backLink);

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes'));
    expect(router.state.matches.at(-1)?.routeId).toBe('/_tabs/recipes/');
  });

  it('loads the generated edit route under the production base path', async () => {
    const router = createRecipeRouter('/meals/recipes/recipe_tray/edit');
    await router.load();

    expect(router.state.location.pathname).toBe('/recipes/recipe_tray/edit');
    expect(router.state.matches.at(-1)?.routeId).toBe('/recipes/$recipeId_/edit');
    expect(
      router.buildLocation({
        to: '/recipes/$recipeId/edit',
        params: { recipeId: 'recipe_tray' }
      }).href
    ).toBe('/meals/recipes/recipe_tray/edit');
  });

  it('cancels new recipe creation back to the collection', async () => {
    const router = createRecipeRouter('/meals/recipes/new');
    await router.load();
    render(
      <RouterContextProvider router={router}>
        <RecipeForm mode="create" onSubmit={vi.fn()} />
      </RouterContextProvider>
    );

    const cancelLink = screen.getByRole('link', { name: 'Cancel' });
    expect(cancelLink.getAttribute('href')).toBe('/meals/recipes');
    fireEvent.click(cancelLink);

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes'));
    expect(router.state.matches.at(-1)?.routeId).toBe('/_tabs/recipes/');
  });
});
