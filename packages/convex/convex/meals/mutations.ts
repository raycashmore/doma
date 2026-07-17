import { v } from 'convex/values';
import { customAlphabet } from 'nanoid/non-secure';

import { mutation, type MutationCtx } from '../_generated/server';
import {
  buildRecipePublicId,
  getWeekDates,
  normalizeRecipeInput,
  type RecipeInput,
  setWeeklyMealAssignment,
  type WeeklyMealAssignmentChange
} from './model';
import { weeklyMealPlanArgs } from './schema';

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

type WeeklyMealAssignmentArgs = WeeklyMealAssignmentChange & {
  weekStart: string;
};

type ApplyWeeklyMealProposalCtx = Pick<MutationCtx, 'auth' | 'db'>;

function reviewedRecipeVersion(inputSnapshotJson: string, recipePublicId: string) {
  try {
    const snapshot = JSON.parse(inputSnapshotJson) as {
      recipes?: Array<{ publicId?: unknown; updatedAt?: unknown }>;
    };
    const recipe = snapshot.recipes?.find((candidate) => candidate.publicId === recipePublicId);
    return typeof recipe?.updatedAt === 'number' ? recipe.updatedAt : null;
  } catch {
    return null;
  }
}

export async function applyWeeklyMealProposalHandler(ctx: ApplyWeeklyMealProposalCtx, args: { runId: string }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const run = await ctx.db
    .query('weeklyMealAgentRuns')
    .withIndex('by_run_id', (q) => q.eq('runId', args.runId))
    .unique();
  if (!run || run.userId !== identity.subject) throw new Error('Meal proposal unavailable');
  if (run.appliedAt) throw new Error('Meal proposal has already been applied');
  if (run.expiresAt <= Date.now()) throw new Error('Meal proposal has expired');
  if (run.validationStatus !== 'valid') throw new Error('Meal proposal unavailable');
  if (run.outcome.kind !== 'proposal') throw new Error('Meal proposal unavailable');

  getWeekDates(run.weekStart);
  const existing = await ctx.db
    .query('weeklyMealPlans')
    .withIndex('by_week_start', (q) => q.eq('weekStart', run.weekStart))
    .unique();
  if ((existing?.updatedAt ?? null) !== run.expectedPlanUpdatedAt) {
    throw new Error('Meal proposal is stale');
  }

  let assignments = existing?.assignments ?? [];
  for (const proposal of run.outcome.assignments) {
    const occupied = assignments.some(
      (assignment) => assignment.day === proposal.day && assignment.meal === proposal.meal
    );
    if (occupied) throw new Error('Meal proposal is stale');

    const recipe = await findRecipeByPublicId(ctx, proposal.recipePublicId);
    if (!recipe) throw new Error('Recipe unavailable');
    if (recipe.updatedAt !== reviewedRecipeVersion(run.inputSnapshotJson, proposal.recipePublicId)) {
      throw new Error('Meal proposal is stale');
    }
    const requiredTag = proposal.meal === 'schoolLunch' ? 'School lunch' : 'Dinner';
    if (!recipe.mealSuitabilityTags.includes(requiredTag)) throw new Error('Recipe is not suitable for this meal');

    assignments = setWeeklyMealAssignment(assignments, {
      day: proposal.day,
      meal: proposal.meal,
      recipePublicId: proposal.recipePublicId
    });
  }

  const now = Date.now();
  const patch = { assignments, updatedAt: now, updatedByUserId: identity.subject };
  let plan;
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    plan = { ...existing, ...patch };
  } else {
    const row = { weekStart: run.weekStart, ...patch, createdAt: now };
    const id = await ctx.db.insert('weeklyMealPlans', row);
    plan = { _id: id, ...row };
  }

  await ctx.db.patch(run._id, { appliedAt: now });
  return plan;
}

export async function setWeeklyMealAssignmentHandler(ctx: RecipesMutationCtx, args: WeeklyMealAssignmentArgs) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  getWeekDates(args.weekStart);

  if (args.recipePublicId) {
    const recipe = await findRecipeByPublicId(ctx, args.recipePublicId);
    if (!recipe) throw new Error('Recipe unavailable');
  }

  const existing = await ctx.db
    .query('weeklyMealPlans')
    .withIndex('by_week_start', (q) => q.eq('weekStart', args.weekStart))
    .unique();
  const assignments = setWeeklyMealAssignment(existing?.assignments ?? [], {
    day: args.day,
    meal: args.meal,
    recipePublicId: args.recipePublicId
  });
  const now = Date.now();
  const patch = {
    assignments,
    updatedAt: now,
    updatedByUserId: identity.subject
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return { ...existing, ...patch };
  }

  const row = {
    weekStart: args.weekStart,
    ...patch,
    createdAt: now
  };
  const id = await ctx.db.insert('weeklyMealPlans', row);
  return { _id: id, ...row };
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

export const setWeeklyMealAssignmentMutation = mutation({
  args: weeklyMealPlanArgs,
  handler: setWeeklyMealAssignmentHandler
});

export const applyWeeklyMealProposal = mutation({
  args: { runId: v.string() },
  handler: applyWeeklyMealProposalHandler
});
