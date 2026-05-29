import { Hono } from 'hono';
import { jsonOk } from './http/json.js';

export function createApp() {
  const app = new Hono();

  app.get('/health', (c) => jsonOk(c, { ok: true }));

  return app;
}

export type BotApp = ReturnType<typeof createApp>;
