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
      busyWeekdays: [],
      avoidIngredient: null,
      preferQuick: false
    });
  });
});

describe('buildWeeklyMealPlan', () => {
  it('uses grounded lunch recipes and intentional leftovers alongside schedule-sensitive dinners', () => {
    const input = buildMealPlannerInput({
      recipes: [
        { title: 'Long dinner', ingredients: 'Rice\nBeans', prepMinutes: 45, mealType: 'Dinner' },
        { title: 'Quick leftovers', ingredients: 'Pasta\nSauce', prepMinutes: 10, mealType: 'Dinner with leftovers' },
        { title: 'Lunch box', ingredients: 'Bread\nFruit', prepMinutes: 5, mealType: 'Lunch' }
      ],
      activeShoppingItemTitles: [],
      busyWeekdays: ['Tuesday']
    });

    expect(buildWeeklyMealPlan(input)).toEqual({
      days: [
        { weekday: 'Monday', dinnerRecipeTitle: 'Long dinner', lunch: { kind: 'recipe', recipeTitle: 'Lunch box' } },
        {
          weekday: 'Tuesday',
          dinnerRecipeTitle: 'Quick leftovers',
          lunch: { kind: 'recipe', recipeTitle: 'Lunch box' }
        },
        {
          weekday: 'Wednesday',
          dinnerRecipeTitle: 'Quick leftovers',
          lunch: { kind: 'leftovers', recipeTitle: 'Quick leftovers' }
        },
        {
          weekday: 'Thursday',
          dinnerRecipeTitle: 'Long dinner',
          lunch: { kind: 'leftovers', recipeTitle: 'Quick leftovers' }
        },
        {
          weekday: 'Friday',
          dinnerRecipeTitle: 'Quick leftovers',
          lunch: { kind: 'recipe', recipeTitle: 'Lunch box' }
        }
      ],
      ingredientDraft: ['Bread', 'Fruit', 'Pasta', 'Sauce', 'Rice', 'Beans']
    });
  });

  it('uses only grounded recipes and excludes already-active shopping items from its ingredient draft', () => {
    const input = buildMealPlannerInput({
      recipes: [
        { title: 'Pasta bake', ingredients: 'Pasta\nTomato sauce\nCheese', prepMinutes: 20, mealType: 'Dinner' },
        { title: 'Bean wraps', ingredients: 'Wraps\nBeans\nCheese', prepMinutes: 10, mealType: 'Dinner' },
        { title: 'Lunch wraps', ingredients: 'Wraps\nFruit', prepMinutes: 5, mealType: 'Lunch' }
      ],
      activeShoppingItemTitles: ['Cheese']
    });

    expect(buildWeeklyMealPlan(input)).toEqual({
      days: [
        { weekday: 'Monday', dinnerRecipeTitle: 'Pasta bake', lunch: { kind: 'recipe', recipeTitle: 'Lunch wraps' } },
        { weekday: 'Tuesday', dinnerRecipeTitle: 'Bean wraps', lunch: { kind: 'recipe', recipeTitle: 'Lunch wraps' } },
        {
          weekday: 'Wednesday',
          dinnerRecipeTitle: 'Pasta bake',
          lunch: { kind: 'recipe', recipeTitle: 'Lunch wraps' }
        },
        { weekday: 'Thursday', dinnerRecipeTitle: 'Bean wraps', lunch: { kind: 'recipe', recipeTitle: 'Lunch wraps' } },
        { weekday: 'Friday', dinnerRecipeTitle: 'Pasta bake', lunch: { kind: 'recipe', recipeTitle: 'Lunch wraps' } }
      ],
      ingredientDraft: ['Wraps', 'Fruit', 'Beans', 'Pasta', 'Tomato sauce']
    });
  });
});
