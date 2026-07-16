import { describe, expect, it } from 'vitest';

import { readRecipeByPublicId, readRecipes } from './queries';

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
