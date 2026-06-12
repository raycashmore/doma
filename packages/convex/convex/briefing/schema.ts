import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const briefingKindValidator = v.literal('morning');

export const briefingItemValidator = v.object({
  text: v.string(),
  kind: v.union(v.literal('routine'), v.literal('important'), v.literal('timing'), v.literal('uncertain')),
  tags: v.array(
    v.union(
      v.literal('wear'),
      v.literal('bring'),
      v.literal('prepare'),
      v.literal('remember'),
      v.literal('coordinate'),
      v.literal('leaveEarlier')
    )
  ),
  sourceIds: v.array(v.string())
});

export const morningBriefingValidator = v.object({
  shouldSend: v.boolean(),
  headline: v.string(),
  routineItems: v.array(briefingItemValidator),
  importantItems: v.array(briefingItemValidator),
  timingNotes: v.array(briefingItemValidator),
  uncertaintyNotes: v.array(briefingItemValidator),
  sourceIdsIgnored: v.array(v.string())
});

export const briefingGenerationStatusValidator = v.union(
  v.literal('ai'),
  v.literal('deterministic'),
  v.literal('fallback'),
  v.literal('setupProblem')
);

export const briefingsTable = defineTable({
  briefingKey: v.string(),
  briefingKind: briefingKindValidator,
  localDate: v.string(),
  generationStatus: briefingGenerationStatusValidator,
  generatedAt: v.number(),
  message: v.string(),
  briefing: morningBriefingValidator,
  sourceIds: v.array(v.string())
})
  .index('by_briefing_key', ['briefingKey'])
  .index('by_local_date', ['briefingKind', 'localDate']);

export const briefingDeliveryAttemptsTable = defineTable({
  briefingKey: v.string(),
  recipientUserId: v.string(),
  attemptedAt: v.number(),
  status: v.union(v.literal('pending'), v.literal('sent'), v.literal('skipped'), v.literal('failed')),
  providerErrorCode: v.optional(v.string())
})
  .index('by_briefing_key', ['briefingKey'])
  .index('by_briefing_recipient', ['briefingKey', 'recipientUserId'])
  .index('by_attempted_at', ['attemptedAt']);
