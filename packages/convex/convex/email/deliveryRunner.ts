import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { action, internalAction } from '../_generated/server';
import {
  createBotGatewayNotificationSender,
  parseBotGatewayOrigin,
  parseRecipientUserIds
} from '../schedule/reminders';
import type { EmailNoticeDeliveryAttempt, EmailNoticeForDelivery } from './delivery';
import { runEmailNoticeDeliveryCycle } from './delivery';

type EmailNoticeDeliveryAttemptRecord = {
  noticeId: string;
  recipientUserId: string;
  attemptedAt: number;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
  providerErrorCode?: string;
};

type EmailNoticeDeliveryStoreRefs = {
  emailNoticeDeliveryRunInputs: FunctionReference<
    'query',
    'internal',
    Record<string, never>,
    {
      notices: EmailNoticeForDelivery[];
      attempts: EmailNoticeDeliveryAttempt[];
    }
  >;
  recordEmailNoticeDeliveryAttempt: FunctionReference<
    'mutation',
    'internal',
    EmailNoticeDeliveryAttemptRecord,
    { claimed?: boolean } | unknown
  >;
};

const deliveryStore: EmailNoticeDeliveryStoreRefs = (
  internal as unknown as {
    email: {
      deliveryStore: EmailNoticeDeliveryStoreRefs;
    };
  }
).email.deliveryStore;

function assertAuthorizedServiceToken(serviceToken: string) {
  const expectedToken = process.env.BOT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) {
    throw new Error('Unauthorized');
  }
}

export function emailNoticeRecipientUserIdsFromEnv(env: { FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS?: string }) {
  return parseRecipientUserIds(env.FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS);
}

export const deliverTelegramWorthyEmailNoticesForBot = action({
  args: {
    serviceToken: v.string(),
    deliveredAt: v.optional(v.number())
  },
  handler: async (ctx, { serviceToken, deliveredAt }) => {
    assertAuthorizedServiceToken(serviceToken);

    const botServiceToken = process.env.BOT_SERVICE_TOKEN;
    if (!botServiceToken) throw new Error('BOT_SERVICE_TOKEN env var is required for email notice delivery');

    const nowMs = deliveredAt ?? Date.now();
    const recipientUserIds = emailNoticeRecipientUserIdsFromEnv({
      FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS: process.env.FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS
    });
    const inputs = await ctx.runQuery(deliveryStore.emailNoticeDeliveryRunInputs, {});

    console.info('[email.delivery] Starting notice delivery run', {
      noticeCount: inputs.notices.length,
      attemptCount: inputs.attempts.length,
      recipientCount: recipientUserIds.length
    });

    if (recipientUserIds.length === 0 || inputs.notices.length === 0) {
      return {
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0
      };
    }

    const result = await runEmailNoticeDeliveryCycle({
      nowMs,
      notices: inputs.notices,
      attempts: inputs.attempts,
      recipientUserIds,
      sendNotification: createBotGatewayNotificationSender({
        botGatewayOrigin: parseBotGatewayOrigin(),
        serviceToken: botServiceToken
      }),
      recordDeliveryAttempt: (attempt) => ctx.runMutation(deliveryStore.recordEmailNoticeDeliveryAttempt, attempt)
    });

    console.info('[email.delivery] Completed notice delivery run', result);

    return result;
  }
});

export const runDueEmailNoticeDelivery = internalAction({
  args: {},
  handler: async (ctx) => {
    const botServiceToken = process.env.BOT_SERVICE_TOKEN;
    if (!botServiceToken) throw new Error('BOT_SERVICE_TOKEN env var is required for email notice delivery');

    const nowMs = Date.now();
    const recipientUserIds = emailNoticeRecipientUserIdsFromEnv({
      FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS: process.env.FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS
    });
    const inputs = await ctx.runQuery(deliveryStore.emailNoticeDeliveryRunInputs, {});

    console.info('[email.delivery] Starting scheduled notice delivery run', {
      noticeCount: inputs.notices.length,
      attemptCount: inputs.attempts.length,
      recipientCount: recipientUserIds.length
    });

    if (recipientUserIds.length === 0 || inputs.notices.length === 0) {
      return {
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0
      };
    }

    const result = await runEmailNoticeDeliveryCycle({
      nowMs,
      notices: inputs.notices,
      attempts: inputs.attempts,
      recipientUserIds,
      sendNotification: createBotGatewayNotificationSender({
        botGatewayOrigin: parseBotGatewayOrigin(),
        serviceToken: botServiceToken
      }),
      recordDeliveryAttempt: (attempt) => ctx.runMutation(deliveryStore.recordEmailNoticeDeliveryAttempt, attempt)
    });

    console.info('[email.delivery] Completed scheduled notice delivery run', result);

    return result;
  }
});
