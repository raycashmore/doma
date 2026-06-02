import { Hono } from 'hono';

import type { BotConfig } from './config.js';
import { getConfig } from './config.js';
import { jsonOk } from './http/json.js';
import { createLinkingRoutes } from './linking/routes.js';
import { createNotificationRoutes } from './notifications/routes.js';
import { sendTelegramMessage } from './providers/telegram/client.js';
import { createTelegramWebhookRoutes } from './providers/telegram/webhook.js';
import { type BotStorage, createRuntimeStorage } from './storage/index.js';

export type CreateAppOptions = {
  config?: BotConfig;
  storage?: BotStorage;
};

export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? getConfig();
  const storage = options.storage ?? createRuntimeStorage(config);
  const app = new Hono();

  app.get('/health', (c) => jsonOk(c, { ok: true }));
  app.route('/linking', createLinkingRoutes({ config, storage }));
  app.route(
    '/notifications',
    createNotificationRoutes({
      serviceToken: config.botServiceToken,
      storage,
      sendTelegramMessage: ({ chatId, text }) =>
        sendTelegramMessage({
          botToken: config.telegramBotToken,
          chatId,
          text
        })
    })
  );
  app.route(
    '/telegram',
    createTelegramWebhookRoutes({
      config,
      storage,
      sendTelegramMessage: ({ chatId, text }) =>
        sendTelegramMessage({
          botToken: config.telegramBotToken,
          chatId,
          text
        })
    })
  );

  return app;
}

export type BotApp = ReturnType<typeof createApp>;
