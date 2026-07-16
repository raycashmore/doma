import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType, ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  recipeMutation: vi.fn(),
  navigate: vi.fn(),
  queryResult: undefined as unknown
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options, useParams: () => ({ recipeId: 'recipe_route' }) }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => mocks.navigate
}));

vi.mock('convex/react', () => ({
  useMutation: () => mocks.recipeMutation,
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
  mocks.recipeMutation.mockReset();
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
    mocks.recipeMutation.mockResolvedValue({ publicId: 'recipe_created' });
    const { Route } = await import('./new');
    const NewRecipeRoute = Route.options.component as ComponentType;
    render(<NewRecipeRoute />);

    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Veggie pasta' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: '400 g pasta' } });
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Cook and serve.' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save meal' })[0]);

    await waitFor(() =>
      expect(mocks.recipeMutation).toHaveBeenCalledWith(expect.objectContaining({ name: 'Veggie pasta' }))
    );
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/recipes/$recipeId', params: { recipeId: 'recipe_created' } });
  });

  it('keeps the create form visible when saving fails', async () => {
    mocks.recipeMutation.mockRejectedValue(new Error('unavailable'));
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

  it('updates a recipe with Convex and navigates to its detail route', async () => {
    mocks.queryResult = {
      publicId: 'recipe_route',
      name: 'Veggie pasta',
      description: 'A simple dinner.',
      preparationTime: '25 min',
      servingsLabel: 'Serves 4',
      mealSuitabilityTags: ['Dinner'],
      ingredientLines: ['400 g pasta'],
      instructions: 'Cook and serve.'
    };
    mocks.recipeMutation.mockResolvedValue({ publicId: 'recipe_route' });
    const { Route } = await import('./$recipeId_.edit');
    const EditRecipeRoute = Route.options.component as ComponentType;
    render(<EditRecipeRoute />);

    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Veggie pasta bake' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save meal' })[0]);

    await waitFor(() =>
      expect(mocks.recipeMutation).toHaveBeenCalledWith(
        expect.objectContaining({ publicId: 'recipe_route', name: 'Veggie pasta bake' })
      )
    );
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/recipes/$recipeId', params: { recipeId: 'recipe_route' } });
  });

  it('keeps the edit form visible when updating fails', async () => {
    mocks.queryResult = {
      publicId: 'recipe_route',
      name: 'Veggie pasta',
      description: '',
      preparationTime: '',
      servingsLabel: '',
      mealSuitabilityTags: [],
      ingredientLines: ['400 g pasta'],
      instructions: 'Cook and serve.'
    };
    mocks.recipeMutation.mockRejectedValue(new Error('unavailable'));
    const { Route } = await import('./$recipeId_.edit');
    const EditRecipeRoute = Route.options.component as ComponentType;
    render(<EditRecipeRoute />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Save meal' })[0]);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The meal could not be saved.'));
    expect(screen.getByDisplayValue('Veggie pasta')).toBeDefined();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
