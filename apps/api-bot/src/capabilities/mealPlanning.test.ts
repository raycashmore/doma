import { describe, expect, it } from 'vitest';

import { buildMealPlannerInput, buildWeeklyMealPlan } from './mealPlanning.js';

describe('buildMealPlannerInput', () => {
  it('keeps only recipes with usable ingredient lines and removes already-active shopping items from the draft', () => {
    expect(
      buildMealPlannerInput({
        recipes: [
          {
            title: 'Pasta bake',
            ingredients: 'Pasta\nTomato sauce\nCheese',
            serves: 4,
            prepMinutes: 20,
            mealType: 'Dinner'
          },
          {
            title: 'Missing ingredients',
            ingredients: '   ',
            serves: 4,
            prepMinutes: 10,
            mealType: 'Dinner'
          }
        ],
        activeShoppingItemTitles: ['tomato sauce']
      })
    ).toEqual({
      recipes: [
        {
          title: 'Pasta bake',
          ingredients: ['Pasta', 'Tomato sauce', 'Cheese'],
          serves: 4,
          prepMinutes: 20,
          mealType: 'Dinner'
        }
      ],
      activeShoppingItemTitles: ['tomato sauce'],
      busyWeekdays: []
    });
  });
});

describe('buildWeeklyMealPlan', () => {
  it('uses only grounded recipes and excludes already-active shopping items from its ingredient draft', () => {
    const input = buildMealPlannerInput({
      recipes: [
        { title: 'Pasta bake', ingredients: 'Pasta\nTomato sauce\nCheese', prepMinutes: 20, mealType: 'Dinner' },
        { title: 'Bean wraps', ingredients: 'Wraps\nBeans\nCheese', prepMinutes: 10, mealType: 'Dinner' }
      ],
      activeShoppingItemTitles: ['Cheese']
    });

    expect(buildWeeklyMealPlan(input)).toEqual({
      days: [
        { weekday: 'Monday', dinnerRecipeTitle: 'Pasta bake' },
        { weekday: 'Tuesday', dinnerRecipeTitle: 'Bean wraps' },
        { weekday: 'Wednesday', dinnerRecipeTitle: 'Pasta bake' },
        { weekday: 'Thursday', dinnerRecipeTitle: 'Bean wraps' },
        { weekday: 'Friday', dinnerRecipeTitle: 'Pasta bake' }
      ],
      ingredientDraft: ['Wraps', 'Beans', 'Pasta', 'Tomato sauce']
    });
  });
});
