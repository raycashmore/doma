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
import { displayMembersFromConfig, parseScheduleCalendars, parseScheduleMembers } from '../schedule/config';
import type { ScheduleEventRow } from '../schedule/mapping';
import {
  createAiMorningBriefing,
  createOpenAiMorningBriefingProvider,
  type MorningBriefingAiGenerationTrace,
  type MorningBriefingAiProvider
} from './ai';
import { botMorningBriefingFromStoreResult } from './botBriefing';
import type { BotMorningBriefing } from './delivery';
import { emitMorningBriefingGenerationTrace, langfuseConfigFromEnv } from './langfuse';
import {
  type BriefingDeliverySlot,
  createDeterministicMorningBriefing,
  type DeterministicMorningBriefing,
  formatBriefingDeliveryMessage,
  isPlainBriefingText,
  isValidMorningBriefingForMembers,
  morningBriefingKey
} from './morning';
import { briefingGenerationStatusValidator, briefingKindValidator, morningBriefingValidator } from './schema';
import { loadMorningBriefingWeatherContext, type MorningBriefingWeatherContext } from './weather';

type StoreGeneratedMorningBriefingArgs = {
  briefingKind: 'morning';
  localDate: string;
  generationStatus: DeterministicMorningBriefing['generationStatus'];
  generatedAt: number;
  message: string;
  briefing: DeterministicMorningBriefing['briefing'];
  sourceIds: string[];
  replaceExisting?: boolean;
};

type GenerationRefs = {
  generateAndStoreMorningBriefing: FunctionReference<
    'action',
    'internal',
    { localDate: string; timeZone?: string; generatedAt: number; replaceExisting?: boolean },
    unknown
  >;
  briefingDeliveryPreviewSource: FunctionReference<
    'query',
    'internal',
    { localDate: string },
    {
      briefingKey: string;
      localDate: string;
      generationStatus: DeterministicMorningBriefing['generationStatus'];
      shouldSend: boolean;
      message: string;
      briefing: DeterministicMorningBriefing['briefing'];
    } | null
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
  briefing?: DeterministicMorningBriefing['briefing'];
}) {
  return {
    briefingKey: briefing.briefingKey,
    localDate: briefing.localDate,
    generationStatus: briefing.generationStatus,
    shouldSend: briefing.shouldSend,
    message: briefing.message,
    ...(briefing.briefing ? { briefing: briefing.briefing } : {})
  };
}

async function storeGeneratedBriefing(
  ctx: { db: MutationCtx['db'] },
  {
    generatedAt,
    replaceExisting = false,
    ...briefing
  }: DeterministicMorningBriefing & {
    generatedAt: number;
    replaceExisting?: boolean;
  }
) {
  const members = displayMembersFromConfig(parseScheduleMembers());
  if (!isValidMorningBriefingForMembers(briefing.briefing, members)) {
    throw new Error('Generated morning briefing is not valid stored briefing content');
  }

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

  if (existing) {
    if (!replaceExisting && isValidMorningBriefingForMembers(existing.briefing, members)) {
      return { inserted: false as const, id: existing._id, briefing: existing };
    }

    await ctx.db.patch(existing._id, row);
    return {
      inserted: false as const,
      ...(replaceExisting ? { replacedExisting: true as const } : { replacedInvalid: true as const }),
      id: existing._id,
      briefing: row
    };
  }

  const id = await ctx.db.insert('briefings', row);
  return { inserted: true as const, id, briefing: row };
}

function morningBriefingProviderFromEnv(): { provider: MorningBriefingAiProvider; model: string } | null {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.MORNING_BRIEFING_AI_MODEL;

  if (!apiKey || !model) {
    return null;
  }

  return { provider: createOpenAiMorningBriefingProvider({ apiKey, model }), model };
}

export async function morningBriefingWeatherFromEnv({
  localDate,
  timeZone
}: {
  localDate: string;
  timeZone: string;
}): Promise<MorningBriefingWeatherContext | undefined> {
  const latitude = coordinateFromEnv(process.env.MORNING_BRIEFING_LATITUDE);
  const longitude = coordinateFromEnv(process.env.MORNING_BRIEFING_LONGITUDE);
  if (latitude === null && longitude === null) return undefined;
  if (latitude === null || longitude === null) {
    console.warn('[briefing.weather] Skipping morning briefing weather because coordinates are incomplete or invalid');
    return undefined;
  }

  const weather = await loadMorningBriefingWeatherContext({ localDate, timeZone, latitude, longitude });
  if (!weather) {
    console.warn('[briefing.weather] Skipping morning briefing weather because forecast context could not be loaded');
    return undefined;
  }
  return weather;
}

function coordinateFromEnv(value: string | undefined) {
  if (!value) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

export async function createMorningBriefing({
  localDate,
  timeZone,
  calendarConfigs,
  events,
  provider,
  members,
  weather,
  onAiGenerationTrace
}: {
  localDate: string;
  timeZone: string;
  calendarConfigs: ReturnType<typeof parseScheduleCalendars>;
  events: ScheduleEventRow[];
  provider: MorningBriefingAiProvider | null;
  members: ReturnType<typeof displayMembersFromConfig>;
  weather?: MorningBriefingWeatherContext;
  onAiGenerationTrace?: (trace: MorningBriefingAiGenerationTrace) => Promise<void> | void;
}) {
  return provider
    ? await createAiMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs,
        events,
        provider,
        members,
        weather,
        onGenerationTrace: onAiGenerationTrace
      })
    : createDeterministicMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs,
        events,
        members
      });
}

export function renderMorningBriefingDeliveryPreview({
  briefing,
  members,
  slot
}: {
  briefing: BotMorningBriefing;
  members: ReturnType<typeof displayMembersFromConfig>;
  slot: BriefingDeliverySlot;
}): BotMorningBriefing {
  const message = briefing.briefing
    ? formatBriefingDeliveryMessage(briefing.briefing, members, { slot })
    : briefing.message;
  const shouldSend = briefing.shouldSend && message.trim().length > 0;

  return {
    ...briefing,
    message,
    shouldSend
  };
}

export function renderBotMorningBriefingForReplay({
  briefing,
  members
}: {
  briefing: BotMorningBriefing;
  members: ReturnType<typeof displayMembersFromConfig>;
}): BotMorningBriefing | null {
  if (briefing.briefing && !isValidMorningBriefingForMembers(briefing.briefing, members)) return null;
  if (!briefing.briefing && !isPlainBriefingText(briefing.message)) return null;

  const message = briefing.briefing
    ? formatBriefingDeliveryMessage(briefing.briefing, members, { slot: 'morning' })
    : briefing.message;
  const shouldSend = briefing.shouldSend && message.trim().length > 0;

  return {
    ...briefing,
    message,
    shouldSend
  };
}

export const morningBriefingEvents = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('scheduleEvents').withIndex('by_start').collect();
  }
});

export const briefingDeliveryPreviewSource = internalQuery({
  args: {
    localDate: v.string()
  },
  handler: async (ctx, { localDate }) => {
    const briefing = await ctx.db
      .query('briefings')
      .withIndex('by_briefing_key', (q) =>
        q.eq('briefingKey', morningBriefingKey({ briefingKind: 'morning', localDate }))
      )
      .unique();

    const members = displayMembersFromConfig(parseScheduleMembers());
    if (!briefing || !isValidMorningBriefingForMembers(briefing.briefing, members)) return null;

    return toBotMorningBriefing({
      briefingKey: briefing.briefingKey,
      localDate: briefing.localDate,
      generationStatus: briefing.generationStatus,
      shouldSend: briefing.briefing.shouldSend,
      message: briefing.message,
      briefing: briefing.briefing
    });
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
    sourceIds: v.array(v.string()),
    replaceExisting: v.optional(v.boolean())
  },
  handler: async (ctx, briefing) => {
    return await storeGeneratedBriefing(ctx, briefing);
  }
});

export const generateAndStoreMorningBriefing = internalAction({
  args: {
    localDate: v.string(),
    timeZone: v.optional(v.string()),
    generatedAt: v.number(),
    replaceExisting: v.optional(v.boolean())
  },
  handler: async (ctx, { localDate, timeZone, generatedAt, replaceExisting }) => {
    const resolvedTimeZone = timeZone ?? process.env.SCHEDULE_TZ ?? 'Australia/Sydney';
    const calendarConfigs = parseScheduleCalendars();
    const members = displayMembersFromConfig(parseScheduleMembers());
    const events = await ctx.runQuery(generationRefs.morningBriefingEvents);
    const provider = morningBriefingProviderFromEnv();
    const canUseAiBriefing =
      provider !== null && calendarConfigs.some((calendar) => calendar.kind === 'dailyRequirements');
    const briefing = await createMorningBriefing({
      localDate,
      timeZone: resolvedTimeZone,
      calendarConfigs,
      events,
      provider: provider?.provider ?? null,
      members,
      weather: canUseAiBriefing
        ? await morningBriefingWeatherFromEnv({ localDate, timeZone: resolvedTimeZone })
        : undefined,
      onAiGenerationTrace: provider
        ? (trace) =>
            emitMorningBriefingGenerationTrace({
              config: langfuseConfigFromEnv(),
              trace: { ...trace, model: provider.model }
            })
        : undefined
    });

    return await ctx.runMutation(generationRefs.storeGeneratedMorningBriefing, {
      briefingKind: briefing.briefingKind,
      localDate: briefing.localDate,
      generationStatus: briefing.generationStatus,
      generatedAt,
      message: briefing.message,
      briefing: briefing.briefing,
      sourceIds: briefing.sourceIds,
      ...(replaceExisting ? { replaceExisting } : {})
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
    const members = displayMembersFromConfig(parseScheduleMembers());

    const briefing = await ctx.db
      .query('briefings')
      .withIndex('by_briefing_key', (q) => q.eq('briefingKey', morningBriefingKey({ briefingKind, localDate })))
      .unique();

    if (!briefing) return null;

    return renderBotMorningBriefingForReplay({
      briefing: toBotMorningBriefing({
        briefingKey: briefing.briefingKey,
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus,
        shouldSend: briefing.briefing.shouldSend,
        message: briefing.message,
        briefing: briefing.briefing
      }),
      members
    });
  }
});

export const renderMorningBriefingDeliveryPreviewForBot = action({
  args: {
    serviceToken: v.string(),
    localDate: v.string(),
    slot: v.union(v.literal('morning'), v.literal('afternoon')),
    timeZone: v.optional(v.string()),
    generatedAt: v.number()
  },
  handler: async (ctx, { serviceToken, localDate, slot, timeZone, generatedAt }) => {
    assertAuthorizedServiceToken(serviceToken);

    const resolvedTimeZone = timeZone ?? process.env.SCHEDULE_TZ ?? 'Australia/Sydney';
    const members = displayMembersFromConfig(parseScheduleMembers());
    const existingBriefing = await ctx.runQuery(generationRefs.briefingDeliveryPreviewSource, { localDate });
    const briefing =
      existingBriefing ??
      botMorningBriefingFromStoreResult(
        await ctx.runAction(generationRefs.generateAndStoreMorningBriefing, {
          localDate,
          timeZone: resolvedTimeZone,
          generatedAt
        })
      );
    return {
      briefing: renderMorningBriefingDeliveryPreview({ briefing, members, slot })
    };
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
    const members = displayMembersFromConfig(parseScheduleMembers());

    const result = await ctx.runAction(generationRefs.generateAndStoreMorningBriefing, {
      localDate,
      timeZone,
      generatedAt
    });
    const briefing = renderBotMorningBriefingForReplay({
      briefing: botMorningBriefingFromStoreResult(result),
      members
    });
    if (!briefing) throw new Error('Generated morning briefing is not valid stored briefing content');

    return {
      briefing
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

// One-off: the stored briefing shape changed (time blocks). Old rows fail the new
// validator, so clear them once after deploying the new schema.
export const clearAllBriefings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('briefings').collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { deleted: rows.length };
  }
});
