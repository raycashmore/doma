import { Hono } from 'hono';
import type { BotConfig } from '../config.js';
import { authenticateClerkRequest } from '../auth/clerk.js';
import { jsonError, jsonOk } from '../http/json.js';
import type { BotStorage } from '../storage/index.js';
import { createPairingToken } from './pairing.js';

export interface CreateLinkingRoutesOptions {
  config: BotConfig;
  storage: BotStorage;
}

export function createLinkingRoutes({
  config,
  storage
}: CreateLinkingRoutesOptions) {
  const routes = new Hono();

  routes.post('/pairing-token', async (c) => {
    c.header('Cache-Control', 'no-store');

    const auth = await authenticateClerkRequest(c.req.raw, config);

    if (!auth) {
      return jsonError(c, 401, 'unauthorized');
    }

    const pairingToken = await createPairingToken({
      storage,
      clerkUserId: auth.userId,
      telegramBotUsername: config.telegramBotUsername
    });

    return jsonOk(c, pairingToken, 201);
  });

  routes.post('/unlink', async (c) => {
    const auth = await authenticateClerkRequest(c.req.raw, config);

    if (!auth) {
      return jsonError(c, 401, 'unauthorized');
    }

    await storage.revokeChannelLink(auth.userId, 'telegram', Date.now());

    return jsonOk(c, { ok: true });
  });

  return routes;
}
