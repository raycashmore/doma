import type { Context } from 'hono';
import { Hono } from 'hono';

import type { BotConfig } from '../../config.js';
import { createCommandDispatcher, type RouteClassifier } from '../../dispatch/router.js';
import type { CapabilityHandler } from '../../dispatch/types.js';
import { jsonError, jsonOk } from '../../http/json.js';
import { consumePairingToken } from '../../linking/pairing.js';
import type { BotStorage } from '../../storage/index.js';
import type { TelegramMessageSender } from './client.js';
import { normalizeTelegramUpdate } from './normalize.js';
import type { TelegramUpdate } from './types.js';

export type CreateTelegramWebhookRoutesOptions = {
  config: BotConfig;
  storage: BotStorage;
  capabilities?: Record<string, CapabilityHandler>;
  classify?: RouteClassifier;
  sendTelegramMessage?: TelegramMessageSender;
};

const startCommandPattern = /^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(\S+))?/i;
const replyTimeoutMs = 1_000;

function extractStartToken(text: string) {
  return startCommandPattern.exec(text)?.[1] ?? null;
}

async function parseTelegramUpdate(c: Context) {
  try {
    return await c.req.json<TelegramUpdate>();
  } catch {
    return null;
  }
}

function isCommandAddressedToThisBot(commandBotUsername: string | undefined, telegramBotUsername: string) {
  return !commandBotUsername || commandBotUsername.toLowerCase() === telegramBotUsername.toLowerCase();
}

export function createTelegramWebhookRoutes({
  config,
  storage,
  capabilities = {},
  classify,
  sendTelegramMessage
}: CreateTelegramWebhookRoutesOptions) {
  const routes = new Hono();
  const dispatcher = createCommandDispatcher({ capabilities, classify });

  async function sendReply(chatId: string, text: string) {
    if (!sendTelegramMessage) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        sendTelegramMessage({ chatId, text }),
        new Promise((resolve) => {
          timeout = setTimeout(resolve, replyTimeoutMs);
        })
      ]);
    } catch {
      // Telegram delivery failures should not make webhook acknowledgement fail.
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  routes.post('/webhook', async (c) => {
    const secret = c.req.header('x-telegram-bot-api-secret-token');

    if (secret !== config.telegramWebhookSecret) {
      return jsonError(c, 401, 'unauthorized');
    }

    const update = await parseTelegramUpdate(c);

    if (!update) {
      return jsonError(c, 400, 'bad_request');
    }

    const inbound = normalizeTelegramUpdate(update);

    if (!inbound) {
      return jsonOk(c, { ok: true });
    }

    if (inbound.command && !isCommandAddressedToThisBot(inbound.commandBotUsername, config.telegramBotUsername)) {
      return jsonOk(c, { ok: true });
    }

    if (inbound.command === 'start') {
      const token = extractStartToken(inbound.text);

      if (!token) {
        await sendReply(
          inbound.providerChatId,
          'Open Doma and request a new Telegram linking code to connect this chat.'
        );
        return jsonOk(c, { ok: true, reply: 'link_required' });
      }

      const pairing = await consumePairingToken({ storage, token });

      if (!pairing) {
        await sendReply(
          inbound.providerChatId,
          'That Doma linking code is invalid or expired. Please request a new one.'
        );
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

      await sendReply(inbound.providerChatId, 'Telegram is linked to Doma.');
      return jsonOk(c, { ok: true, reply: 'linked' });
    }

    const link = await storage.getActiveChannelLinkByProviderUser('telegram', inbound.providerUserId);

    if (!link || link.providerChatId !== inbound.providerChatId) {
      await sendReply(inbound.providerChatId, 'Open Doma and link Telegram before sending commands here.');
      return jsonOk(c, { ok: true, reply: 'link_required' });
    }

    const dispatchResult = await dispatcher.dispatch({
      userId: link.clerkUserId,
      command: inbound.command,
      messageText: inbound.text,
      receivedAt: inbound.receivedAt,
      providerContext: {
        provider: inbound.provider,
        providerUserId: inbound.providerUserId,
        providerChatId: inbound.providerChatId
      }
    });

    if (dispatchResult.kind === 'reply') {
      await sendReply(inbound.providerChatId, dispatchResult.text);
    }

    return jsonOk(c, { ok: true, dispatchResult });
  });

  return routes;
}
