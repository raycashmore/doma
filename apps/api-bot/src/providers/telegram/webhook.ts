import { Hono } from 'hono';
import type { BotConfig } from '../../config.js';
import { jsonError, jsonOk } from '../../http/json.js';
import { consumePairingToken } from '../../linking/pairing.js';
import type { BotStorage } from '../../storage/index.js';
import { normalizeTelegramUpdate } from './normalize.js';
import type { TelegramUpdate } from './types.js';

export interface CreateTelegramWebhookRoutesOptions {
  config: BotConfig;
  storage: BotStorage;
}

const startCommandPattern = /^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(\S+))?/i;

function extractStartToken(text: string) {
  return startCommandPattern.exec(text)?.[1] ?? null;
}

export function createTelegramWebhookRoutes({
  config,
  storage
}: CreateTelegramWebhookRoutesOptions) {
  const routes = new Hono();

  routes.post('/webhook', async (c) => {
    const secret = c.req.header('x-telegram-bot-api-secret-token');

    if (secret !== config.telegramWebhookSecret) {
      return jsonError(c, 401, 'unauthorized');
    }

    const update = await c.req.json<TelegramUpdate>();
    const inbound = normalizeTelegramUpdate(update);

    if (!inbound) {
      return jsonOk(c, { ok: true });
    }

    if (inbound.command === 'start') {
      const token = extractStartToken(inbound.text);

      if (!token) {
        return jsonOk(c, { ok: true, reply: 'link_required' });
      }

      const pairing = await consumePairingToken({ storage, token });

      if (!pairing) {
        return jsonOk(c, { ok: true, reply: 'invalid_or_expired_token' });
      }

      const now = Date.now();

      await storage.upsertChannelLink({
        clerkUserId: pairing.clerkUserId,
        provider: 'telegram',
        providerUserId: inbound.providerUserId,
        providerChatId: inbound.providerChatId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        displayLabel: inbound.displayLabel
      });

      return jsonOk(c, { ok: true, reply: 'linked' });
    }

    const link = await storage.getActiveChannelLinkByProviderUser(
      'telegram',
      inbound.providerUserId
    );

    return jsonOk(c, {
      ok: true,
      reply: link ? 'dispatch_deferred' : 'link_required'
    });
  });

  return routes;
}
