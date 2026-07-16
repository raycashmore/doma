import { describe, expect, it } from 'vitest';

import { buildRecipePublicId, normalizeRecipeInput } from './model';

describe('normalizeRecipeInput', () => {
  it('keeps ingredient lines in their entered order without parsing quantities', () => {
    expect(
      normalizeRecipeInput({
        name: '  Vegetable noodles  ',
        description: '  A quick shared dinner.  ',
        preparationTime: '  25 minutes ',
        servingsLabel: ' Serves 4 ',
        mealSuitabilityTags: [' Weeknight ', 'Lunchbox', 'Weeknight'],
        ingredientLines: [' 2 carrots ', ' 1 packet noodles ', '  '],
        instructions: ' Stir-fry everything together. '
      })
    ).toEqual({
      name: 'Vegetable noodles',
      description: 'A quick shared dinner.',
      preparationTime: '25 minutes',
      servingsLabel: 'Serves 4',
      mealSuitabilityTags: ['Weeknight', 'Lunchbox'],
      ingredientLines: ['2 carrots', '1 packet noodles'],
      instructions: 'Stir-fry everything together.'
    });
  });

  it('rejects a recipe without a name, ingredients, or instructions', () => {
    expect(() =>
      normalizeRecipeInput({
        name: ' ',
        description: '',
        preparationTime: '',
        servingsLabel: '',
        mealSuitabilityTags: [],
        ingredientLines: [],
        instructions: ' '
      })
    ).toThrow('Recipe name is required');

    expect(() =>
      normalizeRecipeInput({
        name: 'Vegetable noodles',
        description: '',
        preparationTime: '',
        servingsLabel: '',
        mealSuitabilityTags: [],
        ingredientLines: [],
        instructions: 'Cook.'
      })
    ).toThrow('At least one ingredient is required');

    expect(() =>
      normalizeRecipeInput({
        name: 'Vegetable noodles',
        description: '',
        preparationTime: '',
        servingsLabel: '',
        mealSuitabilityTags: [],
        ingredientLines: ['1 carrot'],
        instructions: ' '
      })
    ).toThrow('Recipe instructions are required');
  });
});

describe('buildRecipePublicId', () => {
  it('builds the stable ID used by recipe routes', () => {
    expect(buildRecipePublicId('abc123')).toBe('recipe_abc123');
  });
});
