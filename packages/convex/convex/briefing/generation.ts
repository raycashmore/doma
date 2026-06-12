import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { internalAction, internalMutation, internalQuery, type MutationCtx } from '../_generated/server';
import { parseScheduleCalendars } from '../schedule/config';
import type { ScheduleEventRow } from '../schedule/mapping';
import { createAiMorningBriefing, createOpenAiMorningBriefingProvider, type MorningBriefingAiProvider } from './ai';
import { createDeterministicMorningBriefing, type DeterministicMorningBriefing, morningBriefingKey } from './morning';
import { briefingGenerationStatusValidator, briefingKindValidator, morningBriefingValidator } from './schema';

type StoreGeneratedMorningBriefingArgs = {
  briefingKind: 'morning';
  localDate: string;
  generationStatus: DeterministicMorningBriefing['generationStatus'];
  generatedAt: number;
  message: string;
  briefing: DeterministicMorningBriefing['briefing'];
  sourceIds: string[];
};

type GenerationRefs = {
  morningBriefingEvents: FunctionReference<'query', 'internal', Record<string, never>, ScheduleEventRow[]>;
  storeGeneratedMorningBriefing: FunctionReference<'mutation', 'internal', StoreGeneratedMorningBriefingArgs, unknown>;
};

const generationRefs: GenerationRefs = (
  internal as unknown as {
    briefing: {
      generation: GenerationRefs;
    };
  }
).briefing.generation;

async function storeGeneratedBriefing(
  ctx: { db: MutationCtx['db'] },
  { generatedAt, ...briefing }: DeterministicMorningBriefing & { generatedAt: number }
) {
  const briefingKey = morningBriefingKey({
    briefingKind: briefing.briefingKind,
    localDate: briefing.localDate
  });
  const existing = await ctx.db
    .query('briefings')
    .withIndex('by_briefing_key', (q) => q.eq('briefingKey', briefingKey))
    .unique();
  const row = {
    briefingKey,
    briefingKind: briefing.briefingKind,
    localDate: briefing.localDate,
    generationStatus: briefing.generationStatus,
    generatedAt,
    message: briefing.message,
    briefing: briefing.briefing,
    sourceIds: briefing.sourceIds
  };

  if (existing) return { inserted: false as const, id: existing._id, briefing: existing };

  const id = await ctx.db.insert('briefings', row);
  return { inserted: true as const, id, briefing: row };
}

function morningBriefingProviderFromEnv(): MorningBriefingAiProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.MORNING_BRIEFING_AI_MODEL;

  if (!apiKey || !model) {
    return async () => {
      throw new Error('OPENAI_API_KEY and MORNING_BRIEFING_AI_MODEL are required for AI morning briefing generation');
    };
  }

  return createOpenAiMorningBriefingProvider({ apiKey, model });
}

export const morningBriefingEvents = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('scheduleEvents').withIndex('by_start').collect();
  }
});

export const storeGeneratedMorningBriefing = internalMutation({
  args: {
    briefingKind: briefingKindValidator,
    localDate: v.string(),
    generationStatus: briefingGenerationStatusValidator,
    generatedAt: v.number(),
    message: v.string(),
    briefing: morningBriefingValidator,
    sourceIds: v.array(v.string())
  },
  handler: async (ctx, briefing) => {
    return await storeGeneratedBriefing(ctx, briefing);
  }
});

export const generateAndStoreMorningBriefing = internalAction({
  args: {
    localDate: v.string(),
    timeZone: v.optional(v.string()),
    generatedAt: v.number()
  },
  handler: async (ctx, { localDate, timeZone, generatedAt }) => {
    const resolvedTimeZone = timeZone ?? process.env.SCHEDULE_TZ ?? 'Australia/Sydney';
    const briefing = await createAiMorningBriefing({
      localDate,
      timeZone: resolvedTimeZone,
      calendarConfigs: parseScheduleCalendars(),
      events: await ctx.runQuery(generationRefs.morningBriefingEvents),
      provider: morningBriefingProviderFromEnv()
    });

    return await ctx.runMutation(generationRefs.storeGeneratedMorningBriefing, {
      briefingKind: briefing.briefingKind,
      localDate: briefing.localDate,
      generationStatus: briefing.generationStatus,
      generatedAt,
      message: briefing.message,
      briefing: briefing.briefing,
      sourceIds: briefing.sourceIds
    });
  }
});

export const generateAndStoreDeterministicMorningBriefing = internalMutation({
  args: {
    localDate: v.string(),
    timeZone: v.optional(v.string()),
    generatedAt: v.number()
  },
  handler: async (ctx, { localDate, timeZone, generatedAt }) => {
    const briefing = createDeterministicMorningBriefing({
      localDate,
      timeZone: timeZone ?? process.env.SCHEDULE_TZ ?? 'Australia/Sydney',
      calendarConfigs: parseScheduleCalendars(),
      events: await ctx.db.query('scheduleEvents').withIndex('by_start').collect()
    });
    return await storeGeneratedBriefing(ctx, { ...briefing, generatedAt });
  }
});

export const briefingForLocalDate = internalQuery({
  args: {
    briefingKind: v.literal('morning'),
    localDate: v.string()
  },
  handler: async (ctx, { briefingKind, localDate }) => {
    return await ctx.db
      .query('briefings')
      .withIndex('by_briefing_key', (q) => q.eq('briefingKey', morningBriefingKey({ briefingKind, localDate })))
      .unique();
  }
});
