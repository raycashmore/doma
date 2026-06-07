import type { IncomingMessage, ServerResponse } from 'node:http';

import { Hono } from 'hono';

import type { BotConfig } from './config.js';
import { getConfig } from './config.js';
import { createHttpCapability } from './dispatch/httpCapability.js';
import type { CapabilityHandler } from './dispatch/types.js';
import { jsonOk } from './http/json.js';
import { createLinkingRoutes } from './linking/routes.js';
import { createNotificationRoutes } from './notifications/routes.js';
import { sendTelegramMessage } from './providers/telegram/client.js';
import { createTelegramWebhookRoutes } from './providers/telegram/webhook.js';
import { type BotStorage, createRuntimeStorage } from './storage/index.js';

export type CreateAppOptions = {
  config?: BotConfig;
  storage?: BotStorage;
  capabilities?: Record<string, CapabilityHandler>;
};

let runtimeApp: BotApp | undefined;

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
  const sendTelegram = ({ chatId, text }: { chatId: string; text: string }) =>
    sendTelegramMessage({
      botToken: config.telegramBotToken,
      chatId,
      text
    });
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

function getRuntimeApp() {
  runtimeApp ??= createApp();
  return runtimeApp;
}

function headersFromIncomingMessage(req: IncomingMessage) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
}

function requestFromIncomingMessage(req: IncomingMessage) {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `https://${host}`);
  const method = req.method ?? 'GET';
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers: headersFromIncomingMessage(req)
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = req as unknown as BodyInit;
    init.duplex = 'half';
  }

  return new Request(url, init);
}

async function writeFetchResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;

  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  const body = await response.arrayBuffer();
  res.end(Buffer.from(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const response = await getRuntimeApp().fetch(requestFromIncomingMessage(req));
    await writeFetchResponse(res, response);
  } catch {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'internal_server_error' }));
  }
}
