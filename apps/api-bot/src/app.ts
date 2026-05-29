import { Hono } from 'hono';
import type { BotConfig } from './config.js';
import { getConfig } from './config.js';
import { jsonOk } from './http/json.js';
import { createLinkingRoutes } from './linking/routes.js';
import { createRuntimeStorage, type BotStorage } from './storage/index.js';

export interface CreateAppOptions {
  config?: BotConfig;
  storage?: BotStorage;
}

export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? getConfig();
  const storage = options.storage ?? createRuntimeStorage(config);
  const app = new Hono();

  app.get('/health', (c) => jsonOk(c, { ok: true }));
  app.route('/linking', createLinkingRoutes({ config, storage }));

  return app;
}

export type BotApp = ReturnType<typeof createApp>;
