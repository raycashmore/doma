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
