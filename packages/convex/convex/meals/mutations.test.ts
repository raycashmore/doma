import { describe, expect, it, vi } from 'vitest';

import { createRecipeHandler, updateRecipeHandler } from './mutations';

type RecipeRow = {
  _id: string;
  publicId: string;
  name: string;
  description: string;
  preparationTime: string;
  servingsLabel: string;
  mealSuitabilityTags: string[];
  ingredientLines: string[];
  instructions: string;
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
};

function createMutationCtx(identity: { subject: string } | null, initialRows: RecipeRow[] = []) {
  const rows = [...initialRows];
  const insertedRows: Array<Record<string, unknown>> = [];
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];

  return {
    ctx: {
      auth: {
        getUserIdentity: async () => identity
      },
      db: {
        insert: async (table: string, row: Record<string, unknown>) => {
          expect(table).toBe('recipes');
          insertedRows.push(row);
          return 'recipe_row_new';
        },
        patch: async (id: string, patch: Record<string, unknown>) => {
          patches.push({ id, patch });
        },
        query: (table: string) => {
          expect(table).toBe('recipes');
          return {
            withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
              expect(index).toBe('by_public_id');
              let publicId = '';
              apply({
                eq: (field, value) => {
                  expect(field).toBe('publicId');
                  publicId = value;
                  return value;
                }
              });
              return {
                unique: async () => rows.find((row) => row.publicId === publicId) ?? null
              };
            }
          };
        }
      }
    },
    insertedRows,
    patches
  };
}

const recipeInput = {
  name: 'Vegetable noodles',
  description: 'A quick shared dinner.',
  preparationTime: '25 minutes',
  servingsLabel: 'Serves 4',
  mealSuitabilityTags: ['Weeknight'],
  ingredientLines: ['2 carrots', '1 packet noodles'],
  instructions: 'Stir-fry everything together.'
};

describe('createRecipeHandler', () => {
  it('requires an authenticated household user', async () => {
    const { ctx } = createMutationCtx(null);

    await expect(createRecipeHandler(ctx as never, recipeInput, () => 'abc123')).rejects.toThrow('Not authenticated');
  });

  it('stores a Meals-owned recipe with a stable public route ID', async () => {
    const { ctx, insertedRows } = createMutationCtx({ subject: 'user_123' });
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    await expect(createRecipeHandler(ctx as never, recipeInput, () => 'abc123')).resolves.toMatchObject({
      _id: 'recipe_row_new',
      publicId: 'recipe_abc123',
      createdByUserId: 'user_123'
    });

    expect(insertedRows).toEqual([
      {
        ...recipeInput,
        publicId: 'recipe_abc123',
        createdByUserId: 'user_123',
        createdAt: 1700000000000,
        updatedAt: 1700000000000
      }
    ]);
  });
});

describe('updateRecipeHandler', () => {
  it('updates the saved recipe fields without changing its route ID', async () => {
    const existingRecipe: RecipeRow = {
      _id: 'recipe_row_1',
      publicId: 'recipe_existing',
      createdByUserId: 'user_123',
      createdAt: 1,
      updatedAt: 1,
      ...recipeInput
    };
    const { ctx, patches } = createMutationCtx({ subject: 'user_456' }, [existingRecipe]);
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    await expect(
      updateRecipeHandler(ctx as never, {
        publicId: existingRecipe.publicId,
        ...recipeInput,
        name: 'Vegetable noodle bowls'
      })
    ).resolves.toMatchObject({ publicId: existingRecipe.publicId, name: 'Vegetable noodle bowls' });

    expect(patches).toEqual([
      {
        id: existingRecipe._id,
        patch: {
          ...recipeInput,
          name: 'Vegetable noodle bowls',
          updatedAt: 1700000000000
        }
      }
    ]);
  });
});
