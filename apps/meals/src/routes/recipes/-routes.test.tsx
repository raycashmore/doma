import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'react';

const mocks = vi.hoisted(() => ({
  createRecipe: vi.fn(),
  navigate: vi.fn(),
  queryResult: undefined as unknown
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options, useParams: () => ({ recipeId: 'recipe_route' }) }),
  useNavigate: () => mocks.navigate
}));

vi.mock('convex/react', () => ({
  useMutation: () => mocks.createRecipe,
  useQuery: () => mocks.queryResult
}));

vi.mock('@repo/convex', () => ({
  api: {
    meals: {
      mutations: { createRecipe: 'createRecipe', updateRecipe: 'updateRecipe' },
      queries: { getRecipeByPublicId: 'getRecipeByPublicId' }
    }
  }
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test');
  mocks.createRecipe.mockReset();
  mocks.navigate.mockReset();
  mocks.queryResult = undefined;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('recipe routes', () => {
  it('shows loading and not-found states from the detail route', async () => {
    const { Route } = await import('./$recipeId');
    const RecipeDetailRoute = Route.options.component as ComponentType;
    const view = render(<RecipeDetailRoute />);

    expect(screen.getByLabelText('Loading meal')).toBeDefined();

    mocks.queryResult = null;
    view.rerender(<RecipeDetailRoute />);
    expect(screen.getByText('Recipe unavailable.')).toBeDefined();
  });

  it('creates a recipe with Convex and navigates to its detail route', async () => {
    mocks.createRecipe.mockResolvedValue({ publicId: 'recipe_created' });
    const { Route } = await import('./new');
    const NewRecipeRoute = Route.options.component as ComponentType;
    render(<NewRecipeRoute />);

    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Veggie pasta' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: '400 g pasta' } });
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Cook and serve.' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save meal' })[0]);

    await waitFor(() =>
      expect(mocks.createRecipe).toHaveBeenCalledWith(expect.objectContaining({ name: 'Veggie pasta' }))
    );
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/recipes/$recipeId', params: { recipeId: 'recipe_created' } });
  });

  it('keeps the create form visible when saving fails', async () => {
    mocks.createRecipe.mockRejectedValue(new Error('unavailable'));
    const { Route } = await import('./new');
    const NewRecipeRoute = Route.options.component as ComponentType;
    render(<NewRecipeRoute />);

    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Veggie pasta' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: '400 g pasta' } });
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Cook and serve.' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save meal' })[0]);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The meal could not be saved.'));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
