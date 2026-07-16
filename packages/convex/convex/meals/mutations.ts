import { v } from 'convex/values';
import { customAlphabet } from 'nanoid/non-secure';

import { mutation, type MutationCtx } from '../_generated/server';
import { buildRecipePublicId, normalizeRecipeInput, type RecipeInput } from './model';

const createSeed = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 8);
const CREATE_RECIPE_PUBLIC_ID_ATTEMPTS = 3;

type RecipesMutationCtx = Pick<MutationCtx, 'auth' | 'db'>;

async function findRecipeByPublicId(ctx: Pick<RecipesMutationCtx, 'db'>, publicId: string) {
  return ctx.db
    .query('recipes')
    .withIndex('by_public_id', (q) => q.eq('publicId', publicId))
    .unique();
}

export async function createUniqueRecipePublicId(
  ctx: Pick<RecipesMutationCtx, 'db'>,
  createId: () => string = createSeed
) {
  for (let attempt = 0; attempt < CREATE_RECIPE_PUBLIC_ID_ATTEMPTS; attempt += 1) {
    const publicId = buildRecipePublicId(createId());
    const existing = await findRecipeByPublicId(ctx, publicId);
    if (!existing) return publicId;
  }

  throw new Error('Unable to create recipe');
}

export async function createRecipeHandler(
  ctx: RecipesMutationCtx,
  args: RecipeInput,
  createId: () => string = createSeed
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const now = Date.now();
  const recipe = normalizeRecipeInput(args);
  const row = {
    ...recipe,
    publicId: await createUniqueRecipePublicId(ctx, createId),
    createdByUserId: identity.subject,
    createdAt: now,
    updatedAt: now
  };
  const id = await ctx.db.insert('recipes', row);

  return { _id: id, ...row };
}

export async function updateRecipeHandler(ctx: RecipesMutationCtx, args: RecipeInput & { publicId: string }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const existing = await findRecipeByPublicId(ctx, args.publicId);
  if (!existing) throw new Error('Recipe unavailable');

  const patch = { ...normalizeRecipeInput(args), updatedAt: Date.now() };
  await ctx.db.patch(existing._id, patch);

  return { ...existing, ...patch };
}

const recipeArgs = {
  name: v.string(),
  description: v.string(),
  preparationTime: v.string(),
  servingsLabel: v.string(),
  mealSuitabilityTags: v.array(v.string()),
  ingredientLines: v.array(v.string()),
  instructions: v.string()
};

export const createRecipe = mutation({
  args: recipeArgs,
  handler: createRecipeHandler
});

export const updateRecipe = mutation({
  args: { publicId: v.string(), ...recipeArgs },
  handler: updateRecipeHandler
});
