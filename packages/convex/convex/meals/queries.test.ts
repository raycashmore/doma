import { describe, expect, it } from 'vitest';

import * as mealQueries from './queries';

const { readRecipeByPublicId, readRecipes } = mealQueries;

type FutureAsyncFunction = (...args: never[]) => Promise<unknown>;

function getFutureHandler<TFunction extends FutureAsyncFunction>(name: string): TFunction {
  const candidate = (mealQueries as Record<string, unknown>)[name];
  if (typeof candidate === 'function') return candidate as TFunction;

  return (() => Promise.reject(new Error(`${name} is not implemented`))) as TFunction;
}

const firstRecipe = {
  _id: 'recipe_row_1',
  publicId: 'recipe_first',
  name: 'Vegetable noodles',
  description: 'A quick shared dinner.',
  preparationTime: '25 minutes',
  servingsLabel: 'Serves 4',
  mealSuitabilityTags: ['Weeknight'],
  ingredientLines: ['2 carrots', '1 packet noodles'],
  instructions: 'Stir-fry everything together.',
  createdByUserId: 'user_123',
  createdAt: 1,
  updatedAt: 2
} as const;

function createQueryCtx(
  identity: { subject: string } | null,
  rows: readonly [typeof firstRecipe, ...(typeof firstRecipe)[]]
) {
  return {
    auth: {
      getUserIdentity: async () => identity
    },
    db: {
      query: (table: string) => {
        expect(table).toBe('recipes');
        return {
          withIndex: (index: string, apply?: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
            if (index === 'by_updated_at') {
              return { order: () => ({ collect: async () => [...rows] }) };
            }

            expect(index).toBe('by_public_id');
            let publicId = '';
            apply?.({
              eq: (field, value) => {
                expect(field).toBe('publicId');
                publicId = value;
                return value;
              }
            });
            return { unique: async () => rows.find((row) => row.publicId === publicId) ?? null };
          }
        };
      }
    }
  };
}

describe('readRecipes', () => {
  it('requires authentication before reading the shared household cookbook', async () => {
    await expect(readRecipes(createQueryCtx(null, [firstRecipe]) as never)).rejects.toThrow('Not authenticated');
  });

  it('returns every shared household recipe in most-recently-updated order', async () => {
    await expect(readRecipes(createQueryCtx({ subject: 'user_456' }, [firstRecipe]) as never)).resolves.toEqual([
      firstRecipe
    ]);
  });
});

describe('readRecipeByPublicId', () => {
  it('returns null for a recipe ID that is not in the household cookbook', async () => {
    await expect(
      readRecipeByPublicId(createQueryCtx({ subject: 'user_456' }, [firstRecipe]) as never, {
        publicId: 'recipe_missing'
      })
    ).resolves.toBeNull();
  });

  it('returns a saved recipe to any authenticated household user', async () => {
    await expect(
      readRecipeByPublicId(createQueryCtx({ subject: 'user_456' }, [firstRecipe]) as never, {
        publicId: firstRecipe.publicId
      })
    ).resolves.toEqual(firstRecipe);
  });
});

describe('readWeeklyMealPlan', () => {
  const plan = {
    _id: 'plan_row_1',
    weekStart: '2026-07-20',
    assignments: [{ day: 'monday', meal: 'dinner', recipePublicId: 'recipe_first' }],
    createdAt: 1,
    updatedAt: 2,
    updatedByUserId: 'user_123'
  } as const;

  function createWeeklyPlanCtx(identity: { subject: string } | null) {
    return {
      auth: { getUserIdentity: async () => identity },
      db: {
        query: (table: string) => {
          expect(table).toBe('weeklyMealPlans');
          return {
            withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
              expect(index).toBe('by_week_start');
              let weekStart = '';
              apply({
                eq: (field, value) => {
                  expect(field).toBe('weekStart');
                  weekStart = value;
                  return value;
                }
              });
              return { unique: async () => (plan.weekStart === weekStart ? plan : null) };
            }
          };
        }
      }
    };
  }

  it('requires authentication before reading a shared weekly meal plan', async () => {
    const readWeeklyMealPlan =
      getFutureHandler<(ctx: unknown, args: { weekStart: string }) => Promise<unknown>>('readWeeklyMealPlan');

    await expect(readWeeklyMealPlan(createWeeklyPlanCtx(null), { weekStart: plan.weekStart })).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('returns the plan stored for the requested Monday', async () => {
    const readWeeklyMealPlan =
      getFutureHandler<(ctx: unknown, args: { weekStart: string }) => Promise<unknown>>('readWeeklyMealPlan');

    await expect(
      readWeeklyMealPlan(createWeeklyPlanCtx({ subject: 'user_456' }), { weekStart: plan.weekStart })
    ).resolves.toEqual(plan);
  });
});
