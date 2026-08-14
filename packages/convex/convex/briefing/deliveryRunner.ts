import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { displayMembersFromConfig, parseScheduleMembers } from '../schedule/config';
import {
  createBotGatewayNotificationSender,
  parseBotGatewayOrigin,
  parseRecipientUserIds
} from '../schedule/reminders';
import { botMorningBriefingFromStoreResult } from './botBriefing';
import {
  type BotMorningBriefing,
  type BriefingDeliveryAttempt,
  deliverySlotForTime,
  type MorningBriefingDeliveryCounts,
  runMorningBriefingDeliveryCycle
} from './delivery';
import { serializeError } from './errors';

type BriefingDeliveryAttemptRecord = {
  briefingKey: string;
  recipientUserId: string;
  attemptedAt: number;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
  providerErrorCode?: string;
};

type BriefingDeliveryStoreRefs = {
  briefingDeliveryRunInputs: FunctionReference<
    'query',
    'internal',
    { localDate: string },
    {
      briefing: BotMorningBriefing | null;
      attempts: BriefingDeliveryAttempt[];
      lastSyncedAt: number | null;
    }
  >;
  recordBriefingDeliveryAttempt: FunctionReference<
    'mutation',
    'internal',
    BriefingDeliveryAttemptRecord,
    { claimed?: boolean } | unknown
  >;
};

type BriefingGenerationRefs = {
  generateAndStoreMorningBriefing: FunctionReference<
    'action',
    'internal',
    { localDate: string; timeZone?: string; generatedAt: number; replaceExisting?: boolean },
    unknown
  >;
};

type ScheduleSyncRefs = {
  run: FunctionReference<'action', 'internal', Record<string, never>, { count: number; lastSyncedAt: number }>;
};

type BriefingDeliveryScheduleStoreRefs = {
  completeBriefingDeliveryScheduleSlot: FunctionReference<
    'mutation',
    'internal',
    { key: string; completedAt: number; outcome: 'completed' | 'failed' | 'expired' },
    unknown
  >;
};

const deliveryStore: BriefingDeliveryStoreRefs = (
  internal as unknown as {
    briefing: {
      deliveryStore: BriefingDeliveryStoreRefs;
    };
  }
).briefing.deliveryStore;

const generation: BriefingGenerationRefs = (
  internal as unknown as {
    briefing: {
      generation: BriefingGenerationRefs;
    };
  }
).briefing.generation;

const scheduleSync: ScheduleSyncRefs = (
  internal as unknown as {
    schedule: {
      sync: ScheduleSyncRefs;
    };
  }
).schedule.sync;

const deliveryScheduleStore: BriefingDeliveryScheduleStoreRefs = (
  internal as unknown as { briefing: { deliveryScheduleStore: BriefingDeliveryScheduleStoreRefs } }
).briefing.deliveryScheduleStore;

const dueMorningDelivery: FunctionReference<
  'action',
  'internal',
  Record<string, never>,
  MorningBriefingDeliveryCounts
> = (
  internal as unknown as {
    briefing: {
      deliveryRunner: {
        runDueMorningBriefingDelivery: FunctionReference<
          'action',
          'internal',
          Record<string, never>,
          MorningBriefingDeliveryCounts
        >;
      };
    };
  }
).briefing.deliveryRunner.runDueMorningBriefingDelivery;

function formatLocalDate(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(ms));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not format local date');
  }

  return `${year}-${month}-${day}`;
}

export const runDueMorningBriefingDelivery = internalAction({
  args: {},
  handler: async (ctx) => {
    const serviceToken = process.env.BOT_SERVICE_TOKEN;
    if (!serviceToken) throw new Error('BOT_SERVICE_TOKEN env var is required for morning briefing delivery');

    const nowMs = Date.now();
    const timeZone = process.env.MORNING_BRIEFING_TZ ?? process.env.SCHEDULE_TZ ?? 'Australia/Sydney';
    const localDate = formatLocalDate(nowMs, timeZone);
    const members = displayMembersFromConfig(parseScheduleMembers());
    const recipientUserIds = parseRecipientUserIds(process.env.MORNING_BRIEFING_RECIPIENT_USER_IDS);
    const inputs = await ctx.runQuery(deliveryStore.briefingDeliveryRunInputs, { localDate });

    console.info('[briefing.delivery] Starting morning delivery run', {
      localDate,
      timeZone,
      recipientCount: recipientUserIds.length,
      existingBriefing: inputs.briefing !== null,
      attemptCount: inputs.attempts.length,
      lastSyncedAt: inputs.lastSyncedAt
    });

    try {
      const result = await runMorningBriefingDeliveryCycle({
        nowMs,
        timeZone,
        members,
        recipientUserIds,
        attempts: inputs.attempts,
        lastSyncedAt: inputs.lastSyncedAt,
        syncSchedule: async () => {
          try {
            const syncResult = await ctx.runAction(scheduleSync.run, {});
            return { ok: true as const, lastSyncedAt: syncResult.lastSyncedAt };
          } catch (error) {
            console.warn('[briefing.delivery] Schedule sync failed during morning delivery run', {
              localDate,
              ...serializeError(error)
            });
            return { ok: false as const, lastSyncedAt: inputs.lastSyncedAt };
          }
        },
        loadBriefing: async () => inputs.briefing,
        generateBriefing: async ({ localDate: date, timeZone: tz, generatedAt, replaceExisting }) => {
          try {
            const generated = await ctx.runAction(generation.generateAndStoreMorningBriefing, {
              localDate: date,
              timeZone: tz,
              generatedAt,
              ...(replaceExisting ? { replaceExisting } : {})
            });
            const briefing = botMorningBriefingFromStoreResult(generated);

            console.info('[briefing.delivery] Generated morning briefing for delivery', {
              localDate: briefing.localDate,
              generationStatus: briefing.generationStatus,
              shouldSend: briefing.shouldSend,
              messageLength: briefing.message.length
            });

            return briefing;
          } catch (error) {
            console.error('[briefing.delivery] Failed to generate morning briefing for delivery', {
              localDate: date,
              timeZone: tz,
              generatedAt,
              ...serializeError(error)
            });
            throw error;
          }
        },
        sendNotification: createBotGatewayNotificationSender({
          botGatewayOrigin: parseBotGatewayOrigin(),
          serviceToken
        }),
        recordDeliveryAttempt: (attempt) => ctx.runMutation(deliveryStore.recordBriefingDeliveryAttempt, attempt)
      });

      console.info('[briefing.delivery] Completed morning delivery run', {
        localDate,
        ...result
      });

      return result;
    } catch (error) {
      console.error('[briefing.delivery] Morning delivery run failed', {
        localDate,
        timeZone,
        ...serializeError(error)
      });
      throw error;
    }
  }
});

export const runScheduledMorningBriefingDelivery = internalAction({
  args: {
    scheduleSlotKey: v.string(),
    localDate: v.string(),
    slot: v.union(v.literal('morning'), v.literal('afternoon')),
    scheduledAt: v.number()
  },
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const timeZone = process.env.MORNING_BRIEFING_TZ ?? process.env.SCHEDULE_TZ ?? 'Australia/Sydney';
    const localDate = formatLocalDate(nowMs, timeZone);
    if (localDate !== args.localDate || deliverySlotForTime(nowMs, timeZone) !== args.slot) {
      await ctx.runMutation(deliveryScheduleStore.completeBriefingDeliveryScheduleSlot, {
        key: args.scheduleSlotKey,
        completedAt: nowMs,
        outcome: 'expired'
      });
      return { expired: true as const };
    }
    try {
      const result = await ctx.runAction(dueMorningDelivery, {});
      await ctx.runMutation(deliveryScheduleStore.completeBriefingDeliveryScheduleSlot, {
        key: args.scheduleSlotKey,
        completedAt: nowMs,
        outcome: 'completed'
      });
      return result;
    } catch (error) {
      await ctx.runMutation(deliveryScheduleStore.completeBriefingDeliveryScheduleSlot, {
        key: args.scheduleSlotKey,
        completedAt: nowMs,
        outcome: 'failed'
      });
      throw error;
    }
  }
});
