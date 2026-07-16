import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFixtureRecipe, listFixtureRecipes, resetFixtureRecipes, updateFixtureRecipe } from './fixtureRecipes';

beforeEach(() => {
  localStorage.clear();
  resetFixtureRecipes();
});

describe('fixture recipes', () => {
  it('supports the create and edit flow used by no-auth browser verification', () => {
    const created = createFixtureRecipe({
      name: 'Garden pasta',
      description: 'A generic household dinner.',
      preparationTime: '25 min',
      servingsLabel: 'Serves 4',
      mealSuitabilityTags: ['Dinner'],
      ingredientLines: ['250 g pasta', '2 courgettes'],
      instructions: 'Cook the pasta and vegetables.'
    });

    updateFixtureRecipe(created.publicId, { ...created, name: 'Garden pasta bake' });

    expect(listFixtureRecipes()[0]?.name).toBe('Garden pasta bake');
    expect(listFixtureRecipes()[0]?.ingredientLines).toEqual(['250 g pasta', '2 courgettes']);
  });

  it('keeps locally created recipes across a module reload', async () => {
    const created = createFixtureRecipe({
      name: 'Garden pasta',
      description: 'A generic household dinner.',
      preparationTime: '25 min',
      servingsLabel: 'Serves 4',
      mealSuitabilityTags: ['Dinner'],
      ingredientLines: ['250 g pasta'],
      instructions: 'Cook the pasta.'
    });

    vi.resetModules();
    const reloadedStore = await import('./fixtureRecipes');

    expect(reloadedStore.getFixtureRecipe(created.publicId)?.name).toBe('Garden pasta');
  });
});
