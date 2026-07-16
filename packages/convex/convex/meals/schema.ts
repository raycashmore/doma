import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const recipesTable = defineTable({
  publicId: v.string(),
  name: v.string(),
  description: v.string(),
  preparationTime: v.string(),
  servingsLabel: v.string(),
  mealSuitabilityTags: v.array(v.string()),
  ingredientLines: v.array(v.string()),
  instructions: v.string(),
  createdByUserId: v.string(),
  createdAt: v.number(),
  updatedAt: v.number()
})
  .index('by_public_id', ['publicId'])
  .index('by_updated_at', ['updatedAt']);

const weekday = v.union(
  v.literal('monday'),
  v.literal('tuesday'),
  v.literal('wednesday'),
  v.literal('thursday'),
  v.literal('friday')
);

const weeklyMealType = v.union(v.literal('schoolLunch'), v.literal('dinner'));

export const weeklyMealPlansTable = defineTable({
  weekStart: v.string(),
  assignments: v.array(
    v.object({
      day: weekday,
      meal: weeklyMealType,
      recipePublicId: v.string()
    })
  ),
  updatedByUserId: v.string(),
  createdAt: v.number(),
  updatedAt: v.number()
}).index('by_week_start', ['weekStart']);

export const weeklyMealPlanArgs = {
  weekStart: v.string(),
  day: weekday,
  meal: weeklyMealType,
  recipePublicId: v.union(v.string(), v.null())
};
