import type { FunctionReference } from 'convex/server';

import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { createBotGatewayNotificationSender, parseRecipientUserIds } from '../schedule/reminders';
import {
  runSpendingInsightDeliveryCycle,
  type SpendingInsightDeliveryAttempt,
  type SpendingInsightForDelivery
} from './delivery';

export type SpendingInsightDeliveryConfig =
  | {
      ok: true;
      serviceToken: string;
      botGatewayOrigin: string;
      recipientUserIds: string[];
    }
  | { ok: false; reason: 'missing_bot_service_token' | 'missing_bot_gateway_origin' };

export function spendingInsightDeliveryConfigFromEnv(env: {
  BOT_SERVICE_TOKEN?: string;
  BOT_GATEWAY_ORIGIN?: string;
  MORNING_BRIEFING_RECIPIENT_USER_IDS?: string;
}): SpendingInsightDeliveryConfig {
  if (!env.BOT_SERVICE_TOKEN) return { ok: false, reason: 'missing_bot_service_token' };
  if (!env.BOT_GATEWAY_ORIGIN) return { ok: false, reason: 'missing_bot_gateway_origin' };

  return {
    ok: true,
    serviceToken: env.BOT_SERVICE_TOKEN,
    botGatewayOrigin: new URL(env.BOT_GATEWAY_ORIGIN).origin,
    recipientUserIds: parseRecipientUserIds(env.MORNING_BRIEFING_RECIPIENT_USER_IDS)
  };
}

type SpendingInsightDeliveryAttemptRecord = {
  monthKey: string;
  recipientUserId: string;
  attemptedAt: number;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
  providerErrorCode?: string;
};

type SpendingInsightDeliveryStoreRefs = {
  spendingInsightDeliveryRunInputs: FunctionReference<
    'query',
    'internal',
    Record<string, never>,
    {
      insight: SpendingInsightForDelivery | null;
      attempts: SpendingInsightDeliveryAttempt[];
    }
  >;
  recordSpendingInsightDeliveryAttempt: FunctionReference<
    'mutation',
    'internal',
    SpendingInsightDeliveryAttemptRecord,
    { claimed?: boolean } | unknown
  >;
};

const deliveryStore: SpendingInsightDeliveryStoreRefs = (
  internal as unknown as {
    insights: {
      deliveryStore: SpendingInsightDeliveryStoreRefs;
    };
  }
).insights.deliveryStore;

export const runDueSpendingInsightDelivery = internalAction({
  args: {},
  handler: async (ctx) => {
    const config = spendingInsightDeliveryConfigFromEnv({
      BOT_SERVICE_TOKEN: process.env.BOT_SERVICE_TOKEN,
      BOT_GATEWAY_ORIGIN: process.env.BOT_GATEWAY_ORIGIN,
      MORNING_BRIEFING_RECIPIENT_USER_IDS: process.env.MORNING_BRIEFING_RECIPIENT_USER_IDS
    });

    if (!config.ok) {
      console.warn('[insights.delivery] Skipping spending insight delivery run; Telegram is not configured', {
        reason: config.reason
      });
      return { processed: 0, sent: 0, skipped: 0, failed: 0, skippedRun: config.reason };
    }

    const inputs = await ctx.runQuery(deliveryStore.spendingInsightDeliveryRunInputs, {});

    console.info('[insights.delivery] Starting spending insight delivery run', {
      monthKey: inputs.insight?.monthKey ?? null,
      attemptCount: inputs.attempts.length,
      recipientCount: config.recipientUserIds.length
    });

    if (!inputs.insight || config.recipientUserIds.length === 0) {
      return { processed: 0, sent: 0, skipped: 0, failed: 0 };
    }

    const result = await runSpendingInsightDeliveryCycle({
      nowMs: Date.now(),
      insights: [inputs.insight],
      attempts: inputs.attempts,
      recipientUserIds: config.recipientUserIds,
      sendNotification: createBotGatewayNotificationSender({
        botGatewayOrigin: config.botGatewayOrigin,
        serviceToken: config.serviceToken
      }),
      recordDeliveryAttempt: (attempt) => ctx.runMutation(deliveryStore.recordSpendingInsightDeliveryAttempt, attempt)
    });

    console.info('[insights.delivery] Completed spending insight delivery run', {
      monthKey: inputs.insight.monthKey,
      ...result
    });

    return result;
  }
});
