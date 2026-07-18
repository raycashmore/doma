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

export const weekday = v.union(
  v.literal('monday'),
  v.literal('tuesday'),
  v.literal('wednesday'),
  v.literal('thursday'),
  v.literal('friday')
);

export const weeklyMealType = v.union(v.literal('schoolLunch'), v.literal('dinner'));

export const weeklyMealProposalAssignment = v.object({
  day: weekday,
  meal: weeklyMealType,
  recipePublicId: v.string(),
  reason: v.string()
});

export const weeklyMealAgentOutcome = v.union(
  v.object({
    kind: v.literal('proposal'),
    assignments: v.array(weeklyMealProposalAssignment)
  }),
  v.object({
    kind: v.literal('cannotPropose'),
    reason: v.string()
  })
);

export const weeklyMealAgentRunsTable = defineTable({
  runId: v.string(),
  userId: v.string(),
  weekStart: v.string(),
  expectedPlanUpdatedAt: v.union(v.number(), v.null()),
  instruction: v.optional(v.string()),
  model: v.string(),
  promptVersion: v.string(),
  startedAt: v.number(),
  completedAt: v.number(),
  expiresAt: v.number(),
  stepCount: v.number(),
  stopReason: v.string(),
  errorName: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  errorStatusCode: v.optional(v.number()),
  errorType: v.optional(v.string()),
  errorGenerationId: v.optional(v.string()),
  inputTokens: v.number(),
  outputTokens: v.number(),
  toolCallsJson: v.string(),
  inputSnapshotJson: v.string(),
  outcome: weeklyMealAgentOutcome,
  validationStatus: v.union(v.literal('valid'), v.literal('invalid')),
  validationReason: v.optional(v.string()),
  appliedAt: v.optional(v.number())
})
  .index('by_run_id', ['runId'])
  .index('by_user_started_at', ['userId', 'startedAt'])
  .index('by_expires_at', ['expiresAt']);

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
