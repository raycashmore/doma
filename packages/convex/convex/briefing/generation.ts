import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query
} from '../_generated/server';
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
  generateAndStoreMorningBriefing: FunctionReference<
    'action',
    'internal',
    { localDate: string; timeZone?: string; generatedAt: number },
    unknown
  >;
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

function assertAuthorizedServiceToken(serviceToken: string) {
  const expectedToken = process.env.BOT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) {
    throw new Error('Unauthorized');
  }
}

function toBotMorningBriefing(briefing: {
  briefingKey: string;
  localDate: string;
  generationStatus: DeterministicMorningBriefing['generationStatus'];
  shouldSend: boolean;
  message: string;
}) {
  return {
    briefingKey: briefing.briefingKey,
    localDate: briefing.localDate,
    generationStatus: briefing.generationStatus,
    shouldSend: briefing.shouldSend,
    message: briefing.message
  };
}

function botMorningBriefingFromStoreResult(value: unknown) {
  if (typeof value !== 'object' || value === null || !('briefing' in value)) {
    throw new Error('Invalid generated briefing result');
  }

  const { briefing } = value as { briefing: unknown };
  if (typeof briefing !== 'object' || briefing === null) {
    throw new Error('Invalid generated briefing result');
  }

  const row = briefing as Record<string, unknown>;
  if (
    typeof row.briefingKey !== 'string' ||
    typeof row.localDate !== 'string' ||
    typeof row.message !== 'string' ||
    !isBotMorningBriefingRecord(row.briefing) ||
    (row.generationStatus !== 'ai' &&
      row.generationStatus !== 'deterministic' &&
      row.generationStatus !== 'fallback' &&
      row.generationStatus !== 'setupProblem')
  ) {
    throw new Error('Invalid generated briefing result');
  }

  return toBotMorningBriefing({
    briefingKey: row.briefingKey,
    localDate: row.localDate,
    generationStatus: row.generationStatus,
    shouldSend: row.briefing.shouldSend,
    message: row.message
  });
}

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

function isBotMorningBriefingRecord(value: unknown): value is { shouldSend: boolean } {
  return typeof value === 'object' && value !== null && 'shouldSend' in value && typeof value.shouldSend === 'boolean';
}

function morningBriefingProviderFromEnv(): MorningBriefingAiProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.MORNING_BRIEFING_AI_MODEL;

  if (!apiKey || !model) {
    return null;
  }

  return createOpenAiMorningBriefingProvider({ apiKey, model });
}

export async function createMorningBriefing({
  localDate,
  timeZone,
  calendarConfigs,
  events,
  provider
}: {
  localDate: string;
  timeZone: string;
  calendarConfigs: ReturnType<typeof parseScheduleCalendars>;
  events: ScheduleEventRow[];
  provider: MorningBriefingAiProvider | null;
}) {
  return provider
    ? await createAiMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs,
        events,
        provider
      })
    : createDeterministicMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs,
        events
      });
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
    const calendarConfigs = parseScheduleCalendars();
    const events = await ctx.runQuery(generationRefs.morningBriefingEvents);
    const briefing = await createMorningBriefing({
      localDate,
      timeZone: resolvedTimeZone,
      calendarConfigs,
      events,
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

export const briefingForBot = query({
  args: {
    serviceToken: v.string(),
    briefingKind: v.literal('morning'),
    localDate: v.string()
  },
  handler: async (ctx, { serviceToken, briefingKind, localDate }) => {
    assertAuthorizedServiceToken(serviceToken);

    const briefing = await ctx.db
      .query('briefings')
      .withIndex('by_briefing_key', (q) => q.eq('briefingKey', morningBriefingKey({ briefingKind, localDate })))
      .unique();

    return briefing
      ? toBotMorningBriefing({
          briefingKey: briefing.briefingKey,
          localDate: briefing.localDate,
          generationStatus: briefing.generationStatus,
          shouldSend: briefing.briefing.shouldSend,
          message: briefing.message
        })
      : null;
  }
});

export const generateAndStoreMorningBriefingForBot = action({
  args: {
    serviceToken: v.string(),
    localDate: v.string(),
    timeZone: v.optional(v.string()),
    generatedAt: v.number()
  },
  handler: async (ctx, { serviceToken, localDate, timeZone, generatedAt }) => {
    assertAuthorizedServiceToken(serviceToken);

    const result = await ctx.runAction(generationRefs.generateAndStoreMorningBriefing, {
      localDate,
      timeZone,
      generatedAt
    });

    return {
      briefing: botMorningBriefingFromStoreResult(result)
    };
  }
});

export const recordBriefingDeliveryForBot = mutation({
  args: {
    serviceToken: v.string(),
    briefingKey: v.string(),
    recipientUserId: v.string(),
    attemptedAt: v.number(),
    status: v.union(v.literal('sent'), v.literal('skipped'), v.literal('failed')),
    providerErrorCode: v.optional(v.string())
  },
  handler: async (ctx, { serviceToken, ...attempt }) => {
    assertAuthorizedServiceToken(serviceToken);

    const existingAttempts = await ctx.db
      .query('briefingDeliveryAttempts')
      .withIndex('by_briefing_recipient', (q) =>
        q.eq('briefingKey', attempt.briefingKey).eq('recipientUserId', attempt.recipientUserId)
      )
      .collect();
    const sentAttempt = existingAttempts.find((existingAttempt) => existingAttempt.status === 'sent');

    if (sentAttempt) {
      return { inserted: false as const, id: sentAttempt._id };
    }

    const retryableAttempt = existingAttempts[0];
    if (retryableAttempt) {
      await ctx.db.patch(retryableAttempt._id, attempt);
      return { inserted: false as const, id: retryableAttempt._id };
    }

    const id = await ctx.db.insert('briefingDeliveryAttempts', attempt);
    return { inserted: true as const, id };
  }
});
