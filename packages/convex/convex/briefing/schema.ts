import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const briefingKindValidator = v.literal('morning');

export const briefingLineValidator = v.object({
  text: v.string(),
  who: v.array(v.string()),
  sourceIds: v.array(v.string())
});

export const morningBriefingValidator = v.object({
  shouldSend: v.boolean(),
  headline: v.string(),
  morning: v.array(briefingLineValidator),
  afternoon: v.array(briefingLineValidator),
  watchouts: v.array(briefingLineValidator),
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

export const briefingDeliveryScheduleSlotsTable = defineTable({
  key: v.string(),
  localDate: v.string(),
  slot: v.union(v.literal('morning'), v.literal('afternoon')),
  scheduledAt: v.number(),
  status: v.union(v.literal('scheduled'), v.literal('completed'), v.literal('failed'), v.literal('expired')),
  completedAt: v.optional(v.number())
})
  .index('by_key', ['key'])
  .index('by_scheduled_at', ['scheduledAt']);
