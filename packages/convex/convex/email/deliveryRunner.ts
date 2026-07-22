import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { action, type ActionCtx, internalAction } from '../_generated/server';
import {
  createBotGatewayNotificationSender,
  parseBotGatewayOrigin,
  parseRecipientUserIds
} from '../schedule/reminders';
import {
  type EmailReminderDeliveryAttempt,
  type EmailReminderForDelivery,
  runEmailReminderDeliveryCycle
} from './delivery';

type DeliveryStoreRefs = {
  emailReminderDeliveryRunInputs: FunctionReference<
    'query',
    'internal',
    { nowMs: number },
    { reminders: EmailReminderForDelivery[]; attempts: EmailReminderDeliveryAttempt[] }
  >;
  recordEmailReminderDeliveryAttempt: FunctionReference<
    'mutation',
    'internal',
    {
      reminderId: string;
      recipientUserId: string;
      attemptedAt: number;
      status: 'pending' | 'sent' | 'skipped' | 'failed';
      providerErrorCode?: string;
    },
    { claimed?: boolean } | unknown
  >;
};

const store: DeliveryStoreRefs = (internal as unknown as { email: { deliveryStore: DeliveryStoreRefs } }).email
  .deliveryStore;

function assertAuthorizedServiceToken(serviceToken: string) {
  const expectedToken = process.env.BOT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) throw new Error('Unauthorized');
}

export function emailReminderRecipientUserIdsFromEnv(env: { FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS?: string }) {
  return parseRecipientUserIds(env.FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS);
}

async function deliverDueEmailReminders(ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>, nowMs: number) {
  const botServiceToken = process.env.BOT_SERVICE_TOKEN;
  if (!botServiceToken) throw new Error('BOT_SERVICE_TOKEN env var is required for email reminder delivery');
  const recipientUserIds = emailReminderRecipientUserIdsFromEnv({
    FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS: process.env.FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS
  });
  const inputs = await ctx.runQuery(store.emailReminderDeliveryRunInputs, { nowMs });
  return await runEmailReminderDeliveryCycle({
    nowMs,
    reminders: inputs.reminders,
    attempts: inputs.attempts,
    recipientUserIds,
    sendNotification: createBotGatewayNotificationSender({
      botGatewayOrigin: parseBotGatewayOrigin(),
      serviceToken: botServiceToken
    }),
    recordDeliveryAttempt: (attempt) => ctx.runMutation(store.recordEmailReminderDeliveryAttempt, attempt)
  });
}

export const deliverDueEmailRemindersForBot = action({
  args: { serviceToken: v.string(), deliveredAt: v.optional(v.number()) },
  handler: async (ctx, { serviceToken, deliveredAt }) => {
    assertAuthorizedServiceToken(serviceToken);
    return await deliverDueEmailReminders(ctx, deliveredAt ?? Date.now());
  }
});

export const runDueEmailReminderDelivery = internalAction({
  args: {},
  handler: (ctx) => deliverDueEmailReminders(ctx, Date.now())
});
