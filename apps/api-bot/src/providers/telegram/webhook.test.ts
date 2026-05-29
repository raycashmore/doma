import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BotConfig } from '../../config.js';
import { consumePairingToken, createPairingToken } from '../../linking/pairing.js';
import { createMemoryStorage } from '../../storage/memory.js';
import { createTelegramWebhookRoutes } from './webhook.js';

const config: BotConfig = {
  clerkSecretKey: 'clerk-secret-key',
  clerkPublishableKey: 'clerk-publishable-key',
  botServiceToken: 'service-token',
  telegramBotToken: 'telegram-bot-token',
  telegramWebhookSecret: 'telegram-webhook-secret',
  telegramBotUsername: 'doma_bot',
  upstashRedisRestUrl: 'https://upstash.example.com',
  upstashRedisRestToken: 'upstash-token',
  appOrigin: 'https://app.example.com'
};

function telegramRequest(text: string, secret = config.telegramWebhookSecret) {
  return new Request('https://bot.example.com/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': secret
    },
    body: JSON.stringify({
      update_id: 123,
      message: {
        message_id: 456,
        date: 1_700_000_000,
        text,
        from: {
          id: 789,
          is_bot: false,
          first_name: 'Ray',
          username: 'ray_cashmore'
        },
        chat: {
          id: -100123,
          type: 'private'
        }
      }
    })
  });
}

describe('createTelegramWebhookRoutes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects requests without the Telegram webhook secret', async () => {
    const routes = createTelegramWebhookRoutes({
      config,
      storage: createMemoryStorage()
    });

    const response = await routes.request(telegramRequest('/start token', 'wrong'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  it('ignores unsupported updates', async () => {
    const routes = createTelegramWebhookRoutes({
      config,
      storage: createMemoryStorage()
    });

    const response = await routes.request('/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': config.telegramWebhookSecret
      },
      body: JSON.stringify({ update_id: 123 })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('links a Telegram sender when a valid start token is received', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T00:00:00.000Z'));
    const now = Date.now();
    const storage = createMemoryStorage();
    const pairing = await createPairingToken({
      storage,
      clerkUserId: 'user_123',
      telegramBotUsername: config.telegramBotUsername,
      now
    });
    const routes = createTelegramWebhookRoutes({ config, storage });

    const response = await routes.request(telegramRequest(`/start ${pairing.token}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, reply: 'linked' });
    await expect(
      storage.getActiveChannelLinkByProviderUser('telegram', '789')
    ).resolves.toEqual({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      displayLabel: 'ray_cashmore'
    });
    await expect(
      consumePairingToken({ storage, token: pairing.token, now })
    ).resolves.toBeNull();
  });

  it('reports link_required when start has no token', async () => {
    const routes = createTelegramWebhookRoutes({
      config,
      storage: createMemoryStorage()
    });

    const response = await routes.request(telegramRequest('/start'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reply: 'link_required'
    });
  });

  it('reports invalid_or_expired_token when start token cannot be consumed', async () => {
    const routes = createTelegramWebhookRoutes({
      config,
      storage: createMemoryStorage()
    });

    const response = await routes.request(telegramRequest('/start missing-token'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reply: 'invalid_or_expired_token'
    });
  });

  it('defers dispatch for linked non-start messages', async () => {
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
      displayLabel: 'ray_cashmore'
    });
    const routes = createTelegramWebhookRoutes({ config, storage });

    const response = await routes.request(telegramRequest('hello'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reply: 'dispatch_deferred'
    });
  });

  it('requires linking for unlinked non-start messages', async () => {
    const routes = createTelegramWebhookRoutes({
      config,
      storage: createMemoryStorage()
    });

    const response = await routes.request(telegramRequest('hello'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reply: 'link_required'
    });
  });
});
