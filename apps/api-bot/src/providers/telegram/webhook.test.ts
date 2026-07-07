import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BotConfig } from '../../config.js';
import { buildCapabilitiesHint } from '../../dispatch/router.js';
import type { CapabilityRequest } from '../../dispatch/types.js';
import { consumePairingToken, createPairingToken } from '../../linking/pairing.js';
import { createMemoryStorage } from '../../storage/memory.js';
import { createTelegramWebhookRoutes } from './webhook.js';

const config: BotConfig = {
  clerkSecretKey: 'clerk-secret-key',
  clerkPublishableKey: 'clerk-publishable-key',
  botServiceToken: 'service-token',
  convexUrl: 'https://convex.example.com',
  scheduleCapabilityTimeoutMs: 15_000,
  listsCapabilityTimeoutMs: 15_000,
  insightsCapabilityTimeoutMs: 15_000,
  forwardedEmailAllowedSenders: [],
  resendApiKey: undefined,
  resendWebhookSecret: undefined,
  intentRouterAiTimeoutMs: 10_000,
  pairingEnabled: true,
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
          first_name: 'Sam',
          username: 'household_user'
        },
        chat: {
          id: -100123,
          type: 'private'
        }
      }
    })
  });
}

function telegramRequestWithChat(
  text: string,
  chatId: number,
  chatType = 'private',
  secret = config.telegramWebhookSecret
) {
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
          first_name: 'Sam',
          username: 'household_user'
        },
        chat: {
          id: chatId,
          type: chatType
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

  it('rejects requests with a missing Telegram webhook secret', async () => {
    const routes = createTelegramWebhookRoutes({
      config,
      storage: createMemoryStorage()
    });

    const response = await routes.request('/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ update_id: 123 })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  it('returns a stable JSON 400 for malformed JSON', async () => {
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
      body: '{"update_id":'
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'bad_request' });
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
    const sendTelegramMessage = vi.fn(async () => ({ ok: true as const }));
    const routes = createTelegramWebhookRoutes({
      config,
      storage,
      sendTelegramMessage
    });

    const response = await routes.request(telegramRequest(`/start ${pairing.token}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, reply: 'linked' });
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', '789')).resolves.toEqual({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      displayLabel: 'household_user'
    });
    await expect(consumePairingToken({ storage, token: pairing.token, now })).resolves.toBeNull();
    expect(sendTelegramMessage).toHaveBeenCalledWith({
      chatId: '-100123',
      text: 'Telegram is linked to Doma.'
    });
  });

  it('does not link start tokens from non-private chats', async () => {
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

    const response = await routes.request(telegramRequestWithChat(`/start ${pairing.token}`, -100123, 'group'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', '789')).resolves.toBeNull();
    await expect(consumePairingToken({ storage, token: pairing.token, now })).resolves.toEqual({
      clerkUserId: 'user_123'
    });
  });

  it('links when start is addressed to this bot username', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T00:00:00.000Z'));
    const botConfig: BotConfig = {
      ...config,
      telegramBotUsername: 'DomaBot'
    };
    const storage = createMemoryStorage();
    const pairing = await createPairingToken({
      storage,
      clerkUserId: 'user_123',
      telegramBotUsername: botConfig.telegramBotUsername,
      now: Date.now()
    });
    const routes = createTelegramWebhookRoutes({ config: botConfig, storage });

    const response = await routes.request(telegramRequest(`/start@DomaBot ${pairing.token}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, reply: 'linked' });
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', '789')).resolves.toMatchObject({
      clerkUserId: 'user_123',
      providerChatId: '-100123'
    });
  });

  it('links when start bot username casing differs from config', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-30T00:00:00.000Z'));
    const botConfig: BotConfig = {
      ...config,
      telegramBotUsername: 'DomaBot'
    };
    const storage = createMemoryStorage();
    const pairing = await createPairingToken({
      storage,
      clerkUserId: 'user_123',
      telegramBotUsername: botConfig.telegramBotUsername,
      now: Date.now()
    });
    const routes = createTelegramWebhookRoutes({ config: botConfig, storage });

    const response = await routes.request(telegramRequest(`/start@domabot ${pairing.token}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, reply: 'linked' });
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', '789')).resolves.toMatchObject({
      clerkUserId: 'user_123',
      providerChatId: '-100123'
    });
  });

  it('ignores start commands addressed to another bot username', async () => {
    const storage = createMemoryStorage();
    const pairing = await createPairingToken({
      storage,
      clerkUserId: 'user_123',
      telegramBotUsername: config.telegramBotUsername
    });
    const routes = createTelegramWebhookRoutes({ config, storage });

    const response = await routes.request(telegramRequest(`/start@OtherBot ${pairing.token}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', '789')).resolves.toBeNull();
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

  it('dispatches linked schedule commands to the matching capability', async () => {
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
      displayLabel: 'household_user'
    });
    const schedule = vi.fn(async () => ({
      kind: 'reply' as const,
      text: 'Schedule received.'
    }));
    const sendTelegramMessage = vi.fn(async () => ({ ok: true as const }));
    const routes = createTelegramWebhookRoutes({
      config,
      storage,
      capabilities: { schedule },
      sendTelegramMessage
    });

    const response = await routes.request(telegramRequest('/schedule tomorrow'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      dispatchResult: { kind: 'reply', text: 'Schedule received.' }
    });
    expect(schedule).toHaveBeenCalledWith({
      userId: 'user_123',
      command: 'schedule',
      messageText: '/schedule tomorrow',
      receivedAt: 1_700_000_000_000,
      providerContext: {
        provider: 'telegram',
        providerUserId: '789',
        providerChatId: '-100123'
      }
    } satisfies CapabilityRequest);
    expect(sendTelegramMessage).toHaveBeenCalledWith({
      chatId: '-100123',
      text: 'Schedule received.'
    });
  });

  it('sends capability replies to Telegram as plain text', async () => {
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
      displayLabel: 'household_user'
    });
    const schedule = vi.fn(async () => ({
      kind: 'reply' as const,
      text: 'Library bag.'
    }));
    const sendTelegramMessage = vi.fn(async () => ({ ok: true as const }));
    const routes = createTelegramWebhookRoutes({
      config,
      storage,
      capabilities: { schedule },
      sendTelegramMessage
    });

    const response = await routes.request(telegramRequest('/schedule briefing morning'));

    expect(response.status).toBe(200);
    expect(sendTelegramMessage).toHaveBeenCalledWith({
      chatId: '-100123',
      text: 'Library bag.'
    });
  });

  it('routes free text through the injected classifier to the selected capability unchanged', async () => {
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
      displayLabel: 'household_user'
    });
    const lists = vi.fn(async () => ({ kind: 'reply' as const, text: 'Added to your list.' }));
    const classify = vi.fn(async () => ({ capability: 'lists' }));
    const sendTelegramMessage = vi.fn(async () => ({ ok: true as const }));
    const routes = createTelegramWebhookRoutes({
      config,
      storage,
      capabilities: { lists },
      classify,
      sendTelegramMessage
    });

    const response = await routes.request(telegramRequest('we are out of milk and eggs'));

    expect(response.status).toBe(200);
    expect(classify).toHaveBeenCalledWith('we are out of milk and eggs');
    expect(lists).toHaveBeenCalledWith({
      userId: 'user_123',
      command: undefined,
      messageText: 'we are out of milk and eggs',
      receivedAt: 1_700_000_000_000,
      providerContext: {
        provider: 'telegram',
        providerUserId: '789',
        providerChatId: '-100123'
      }
    } satisfies CapabilityRequest);
    expect(sendTelegramMessage).toHaveBeenCalledWith({
      chatId: '-100123',
      text: 'Added to your list.'
    });
  });

  it('does not fail the webhook when sending a reply fails', async () => {
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
      displayLabel: 'household_user'
    });
    const sendTelegramMessage = vi.fn(async () => ({
      ok: false as const,
      errorCode: '500'
    }));
    const routes = createTelegramWebhookRoutes({
      config,
      storage,
      sendTelegramMessage
    });

    const response = await routes.request(telegramRequest('hello'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      dispatchResult: {
        kind: 'reply',
        text: buildCapabilitiesHint()
      }
    });
  });

  it('does not wait indefinitely when sending a reply hangs', async () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
      displayLabel: 'household_user'
    });
    const sendTelegramMessage = vi.fn(() => new Promise<never>(() => undefined));
    const routes = createTelegramWebhookRoutes({
      config,
      storage,
      sendTelegramMessage
    });

    const responsePromise = routes.request(telegramRequest('hello'));
    await vi.advanceTimersByTimeAsync(1_000);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      dispatchResult: {
        kind: 'reply',
        text: buildCapabilitiesHint()
      }
    });
  });

  it('returns the capabilities hint for unroutable linked plain text', async () => {
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
      displayLabel: 'household_user'
    });
    const routes = createTelegramWebhookRoutes({ config, storage });

    const response = await routes.request(telegramRequest('hello'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      dispatchResult: {
        kind: 'reply',
        text: buildCapabilitiesHint()
      }
    });
  });

  it('requires relinking when a linked user sends from a different chat', async () => {
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
      displayLabel: 'household_user'
    });
    const routes = createTelegramWebhookRoutes({ config, storage });

    const response = await routes.request(telegramRequestWithChat('hello', -100999));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reply: 'link_required'
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
