import type { FunctionReference } from 'convex/server';

import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import {
  createBotGatewayNotificationSender,
  parseBotGatewayOrigin,
  parseRecipientUserIds
} from '../schedule/reminders';
import { type BotMorningBriefing, type BriefingDeliveryAttempt, runMorningBriefingDeliveryCycle } from './delivery';

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

function botMorningBriefingFromStoreResult(value: unknown): BotMorningBriefing {
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
    (row.generationStatus !== 'ai' &&
      row.generationStatus !== 'deterministic' &&
      row.generationStatus !== 'fallback' &&
      row.generationStatus !== 'setupProblem')
  ) {
    throw new Error('Invalid generated briefing result');
  }

  return {
    briefingKey: row.briefingKey,
    localDate: row.localDate,
    generationStatus: row.generationStatus,
    message: row.message
  };
}

export const runDueMorningBriefingDelivery = internalAction({
  args: {},
  handler: async (ctx) => {
    const serviceToken = process.env.BOT_SERVICE_TOKEN;
    if (!serviceToken) throw new Error('BOT_SERVICE_TOKEN env var is required for morning briefing delivery');

    const nowMs = Date.now();
    const timeZone = process.env.MORNING_BRIEFING_TZ ?? process.env.SCHEDULE_TZ ?? 'Australia/Sydney';
    const localDate = formatLocalDate(nowMs, timeZone);
    const inputs = await ctx.runQuery(deliveryStore.briefingDeliveryRunInputs, { localDate });

    return await runMorningBriefingDeliveryCycle({
      nowMs,
      timeZone,
      recipientUserIds: parseRecipientUserIds(process.env.MORNING_BRIEFING_RECIPIENT_USER_IDS),
      attempts: inputs.attempts,
      lastSyncedAt: inputs.lastSyncedAt,
      syncSchedule: async () => {
        try {
          const result = await ctx.runAction(scheduleSync.run, {});
          return { ok: true as const, lastSyncedAt: result.lastSyncedAt };
        } catch {
          return { ok: false as const, lastSyncedAt: inputs.lastSyncedAt };
        }
      },
      loadBriefing: async () => inputs.briefing,
      generateBriefing: async ({ localDate: date, timeZone: tz, generatedAt }) => {
        const result = await ctx.runAction(generation.generateAndStoreMorningBriefing, {
          localDate: date,
          timeZone: tz,
          generatedAt
        });

        return botMorningBriefingFromStoreResult(result);
      },
      sendNotification: createBotGatewayNotificationSender({
        botGatewayOrigin: parseBotGatewayOrigin(),
        serviceToken
      }),
      recordDeliveryAttempt: (attempt) => ctx.runMutation(deliveryStore.recordBriefingDeliveryAttempt, attempt)
    });
  }
});
