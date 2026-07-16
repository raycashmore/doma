import { describe, expect, it } from 'vitest';

import {
  buildRecipePublicId,
  getNextWeekStart,
  getWeekDates,
  normalizeRecipeInput,
  setWeeklyMealAssignment,
  shiftWeekStart
} from './model';

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

describe('weekly meal plan dates', () => {
  it('builds the Monday-to-Friday dates for a Monday week start', () => {
    expect(getWeekDates('2026-07-20')).toEqual(['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24']);
  });

  it('rejects a week start that is not a Monday', () => {
    expect(() => getWeekDates('2026-07-21')).toThrow('Week start must be a Monday');
  });

  it('moves between Monday week starts without relying on the browser timezone', () => {
    expect(shiftWeekStart('2026-07-20', -1)).toBe('2026-07-13');
    expect(shiftWeekStart('2026-07-20', 1)).toBe('2026-07-27');
  });

  it('selects the next Monday as the default planning week', () => {
    expect(getNextWeekStart(new Date('2026-07-16T09:00:00.000Z'))).toBe('2026-07-20');
    expect(getNextWeekStart(new Date('2026-07-20T09:00:00.000Z'))).toBe('2026-07-27');
  });

  it('uses the household calendar date across the Sydney Sunday-to-Monday boundary', () => {
    expect(getNextWeekStart(new Date('2026-07-19T13:30:00.000Z'))).toBe('2026-07-20');
    expect(getNextWeekStart(new Date('2026-07-19T14:30:00.000Z'))).toBe('2026-07-27');
  });
});

describe('setWeeklyMealAssignment', () => {
  it('replaces one meal slot and keeps assignments in weekday and meal order', () => {
    expect(
      setWeeklyMealAssignment(
        [
          { day: 'tuesday', meal: 'dinner', recipePublicId: 'recipe_soup' },
          { day: 'monday', meal: 'schoolLunch', recipePublicId: 'recipe_old' }
        ],
        { day: 'monday', meal: 'schoolLunch', recipePublicId: 'recipe_wraps' }
      )
    ).toEqual([
      { day: 'monday', meal: 'schoolLunch', recipePublicId: 'recipe_wraps' },
      { day: 'tuesday', meal: 'dinner', recipePublicId: 'recipe_soup' }
    ]);
  });

  it('clears only the selected meal slot', () => {
    expect(
      setWeeklyMealAssignment(
        [
          { day: 'monday', meal: 'schoolLunch', recipePublicId: 'recipe_wraps' },
          { day: 'monday', meal: 'dinner', recipePublicId: 'recipe_tray' }
        ],
        { day: 'monday', meal: 'schoolLunch', recipePublicId: null }
      )
    ).toEqual([{ day: 'monday', meal: 'dinner', recipePublicId: 'recipe_tray' }]);
  });
});
