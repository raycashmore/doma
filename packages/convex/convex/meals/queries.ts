import { v } from 'convex/values';

import { query, type QueryCtx } from '../_generated/server';
import { getWeekDates } from './model';

type RecipesQueryCtx = Pick<QueryCtx, 'auth' | 'db'>;

async function requireHouseholdUser(ctx: Pick<RecipesQueryCtx, 'auth'>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity.subject;
}

export async function readRecipes(ctx: RecipesQueryCtx) {
  await requireHouseholdUser(ctx);
  return ctx.db.query('recipes').withIndex('by_updated_at').order('desc').collect();
}

export async function readRecipeByPublicId(ctx: RecipesQueryCtx, { publicId }: { publicId: string }) {
  await requireHouseholdUser(ctx);
  return ctx.db
    .query('recipes')
    .withIndex('by_public_id', (q) => q.eq('publicId', publicId))
    .unique();
}

export async function readWeeklyMealPlan(ctx: RecipesQueryCtx, { weekStart }: { weekStart: string }) {
  await requireHouseholdUser(ctx);
  getWeekDates(weekStart);
  return ctx.db
    .query('weeklyMealPlans')
    .withIndex('by_week_start', (q) => q.eq('weekStart', weekStart))
    .unique();
}

export const listRecipes = query({
  args: {},
  handler: readRecipes
});

export const getRecipeByPublicId = query({
  args: { publicId: v.string() },
  handler: readRecipeByPublicId
});

export const getWeeklyMealPlan = query({
  args: { weekStart: v.string() },
  handler: readWeeklyMealPlan
});
