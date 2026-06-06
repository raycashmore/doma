import { Hono } from 'hono';

import type { BotConfig } from './config.js';
import { getConfig } from './config.js';
import { createHttpCapability } from './dispatch/httpCapability.js';
import type { CapabilityHandler } from './dispatch/types.js';
import { jsonOk } from './http/json.js';
import { createLinkingRoutes } from './linking/routes.js';
import { createNotificationRoutes, sendNotificationToLinkedTelegram } from './notifications/routes.js';
import { sendTelegramMessage } from './providers/telegram/client.js';
import { createTelegramWebhookRoutes } from './providers/telegram/webhook.js';
import { createConvexScheduleReminderStore } from './reminders/convexStore.js';
import {
  createScheduleReminderRoutes,
  type ScheduleReminderNotificationSender,
  type ScheduleReminderStore
} from './reminders/schedule.js';
import { type BotStorage, createRuntimeStorage } from './storage/index.js';

export type CreateAppOptions = {
  config?: BotConfig;
  storage?: BotStorage;
  capabilities?: Record<string, CapabilityHandler>;
  scheduleReminderStore?: ScheduleReminderStore;
  sendScheduleReminderNotification?: ScheduleReminderNotificationSender;
};

function createRuntimeCapabilities(config: BotConfig): Record<string, CapabilityHandler> {
  if (!config.scheduleCapabilityUrl) {
    return {};
  }

  return {
    schedule: createHttpCapability({
      endpointUrl: config.scheduleCapabilityUrl,
      serviceToken: config.botServiceToken
    })
  };
}

export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? getConfig();
  const storage = options.storage ?? createRuntimeStorage(config);
  const capabilities = options.capabilities ?? createRuntimeCapabilities(config);
  const scheduleReminderStore =
    options.scheduleReminderStore ??
    createConvexScheduleReminderStore({
      convexUrl: config.convexUrl,
      serviceToken: config.botServiceToken
    });
  const sendTelegram = ({ chatId, text }: { chatId: string; text: string }) =>
    sendTelegramMessage({
      botToken: config.telegramBotToken,
      chatId,
      text
    });
  const sendScheduleReminderNotification: ScheduleReminderNotificationSender =
    options.sendScheduleReminderNotification ??
    ((notification) =>
      sendNotificationToLinkedTelegram({
        storage,
        sendTelegramMessage: sendTelegram,
        notification
      }).then((result) => ({
        status: result.status,
        errorCode: result.status === 'failed' ? result.errorCode : undefined
      })));
  const app = new Hono();

  app.get('/health', (c) => jsonOk(c, { ok: true }));
  app.route('/linking', createLinkingRoutes({ config, storage }));
  app.route(
    '/notifications',
    createNotificationRoutes({
      serviceToken: config.botServiceToken,
      storage,
      sendTelegramMessage: sendTelegram
    })
  );
  app.route(
    '/reminders/schedule',
    createScheduleReminderRoutes({
      serviceToken: config.botServiceToken,
      cronSecret: config.cronSecret,
      recipientUserIds: config.scheduleReminderRecipientUserIds,
      leadTimeMinutes: config.scheduleReminderLeadTimeMinutes,
      timeZone: config.scheduleReminderTimeZone,
      store: scheduleReminderStore,
      sendNotification: sendScheduleReminderNotification
    })
  );
  app.route(
    '/telegram',
    createTelegramWebhookRoutes({
      config,
      storage,
      capabilities,
      sendTelegramMessage: sendTelegram
    })
  );

  return app;
}

export type BotApp = ReturnType<typeof createApp>;
