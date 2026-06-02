import { randomUUID } from 'node:crypto';

import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import { isAuthorizedServiceRequest } from '../auth/serviceAuth.js';
import { jsonError, jsonOk } from '../http/json.js';
import type { TelegramMessageSender } from '../providers/telegram/client.js';
import type { BotStorage } from '../storage/index.js';

export type CreateNotificationRoutesOptions = {
  serviceToken: string;
  storage: BotStorage;
  sendTelegramMessage: TelegramMessageSender;
};

const notificationSchema = z.object({
  recipientUserId: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  message: z.string().trim().min(1).max(4000),
  metadata: z.record(z.string(), z.string()).optional()
});

async function parseNotificationBody(c: Context) {
  try {
    return await c.req.json<unknown>();
  } catch {
    return undefined;
  }
}

async function sendNotification(sendTelegramMessage: TelegramMessageSender, chatId: string, text: string) {
  try {
    return await sendTelegramMessage({ chatId, text });
  } catch {
    return { ok: false as const, errorCode: 'network_error' };
  }
}

export function createNotificationRoutes({
  serviceToken,
  storage,
  sendTelegramMessage
}: CreateNotificationRoutesOptions) {
  const routes = new Hono();

  routes.post('/send', async (c) => {
    if (!isAuthorizedServiceRequest(c.req.raw, serviceToken)) {
      return jsonError(c, 401, 'unauthorized');
    }

    const body = await parseNotificationBody(c);

    if (body === undefined) {
      return jsonError(c, 400, 'bad_request');
    }

    const notification = notificationSchema.safeParse(body);

    if (!notification.success) {
      return jsonError(c, 400, 'invalid_notification');
    }

    const link = await storage.getActiveChannelLinkForUser(notification.data.recipientUserId, 'telegram');
    const createdAt = Date.now();

    if (!link) {
      await storage.saveNotificationAttempt({
        id: randomUUID(),
        recipientUserId: notification.data.recipientUserId,
        provider: 'telegram',
        topic: notification.data.topic,
        status: 'skipped',
        providerErrorCode: 'no_linked_channel',
        createdAt
      });

      return jsonOk(c, {
        status: 'skipped',
        reason: 'no_linked_channel'
      });
    }

    const sendResult = await sendNotification(sendTelegramMessage, link.providerChatId, notification.data.message);
    const status = sendResult.ok ? 'sent' : 'failed';
    const errorCode = sendResult.ok ? undefined : sendResult.errorCode;

    await storage.saveNotificationAttempt({
      id: randomUUID(),
      recipientUserId: notification.data.recipientUserId,
      provider: 'telegram',
      topic: notification.data.topic,
      status,
      providerErrorCode: errorCode,
      createdAt
    });

    return jsonOk(c, {
      status,
      provider: 'telegram',
      errorCode
    });
  });

  return routes;
}
