import type { FunctionReference } from 'convex/server';

import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import {
  createBotGatewayNotificationSender,
  parseBotGatewayOrigin,
  parseRecipientUserIds
} from '../schedule/reminders';
import { botMorningBriefingFromStoreResult } from './botBriefing';
import { type BotMorningBriefing, type BriefingDeliveryAttempt, runMorningBriefingDeliveryCycle } from './delivery';
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
    { localDate: string; timeZone?: string; generatedAt: number },
    unknown
  >;
};

type ScheduleSyncRefs = {
  run: FunctionReference<'action', 'internal', Record<string, never>, { count: number; lastSyncedAt: number }>;
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
        generateBriefing: async ({ localDate: date, timeZone: tz, generatedAt }) => {
          try {
            const generated = await ctx.runAction(generation.generateAndStoreMorningBriefing, {
              localDate: date,
              timeZone: tz,
              generatedAt
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
