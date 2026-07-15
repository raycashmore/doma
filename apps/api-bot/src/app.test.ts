import { afterEach, describe, expect, it, vi } from 'vitest';

import defaultExport, { createApp } from './app.js';
import { authenticateClerkRequest } from './auth/clerk.js';
import type { BotConfig } from './config.js';
import { createMemoryStorage } from './storage/memory.js';

vi.mock('./auth/clerk.js', () => ({
  authenticateClerkRequest: vi.fn()
}));

const testConfig: BotConfig = {
  clerkSecretKey: 'clerk-secret-key',
  clerkPublishableKey: 'clerk-publishable-key',
  botServiceToken: 'service-token',
  convexUrl: 'https://convex.example.com',
  scheduleCapabilityUrl: undefined,
  scheduleCapabilityTimeoutMs: 15_000,
  listsCapabilityTimeoutMs: 15_000,
  insightsCapabilityTimeoutMs: 15_000,
  forwardedEmailAllowedSenders: ['forwarder@example.com'],
  resendApiKey: 'resend-api-key',
  resendWebhookSecret: 'whsec_dGVzdC1vbmx5LXJlc2VuZC13ZWJob29rLXNlY3JldA==',
  intentRouterAiTimeoutMs: 10_000,
  pairingEnabled: true,
  telegramBotToken: 'telegram-bot-token',
  telegramWebhookSecret: 'telegram-webhook-secret',
  telegramBotUsername: 'doma_bot',
  upstashRedisRestUrl: 'https://upstash.example.com',
  upstashRedisRestToken: 'upstash-token',
  appOrigin: 'https://app.example.com'
};

describe('api-bot app', () => {
  afterEach(() => {
    vi.mocked(authenticateClerkRequest).mockReset();
  });

  it('returns health status', async () => {
    const app = createApp({
      config: testConfig,
      storage: createMemoryStorage(),
      captureForwardedEmail: async () => ({ status: 'created', capturedEmailId: 'captured_email_123' })
    });

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('serves non-email routes without a Convex URL when forwarded email capture is unused', async () => {
    const app = createApp({
      config: {
        ...testConfig,
        convexUrl: undefined
      },
      storage: createMemoryStorage()
    });

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('keeps src/app deployable as a Vercel serverless entrypoint', () => {
    expect(defaultExport).toEqual(expect.any(Function));
  });

  it('mounts linking routes', async () => {
    vi.mocked(authenticateClerkRequest).mockResolvedValueOnce({
      userId: 'user_123'
    });
    const app = createApp({
      config: testConfig,
      storage: createMemoryStorage()
    });

    const response = await app.request('/linking/pairing-token', {
      method: 'POST'
    });

    expect(response.status).toBe(201);
  });

  it('mounts Telegram webhook routes', async () => {
    const app = createApp({
      config: testConfig,
      storage: createMemoryStorage()
    });

    const response = await app.request('/telegram/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': testConfig.telegramWebhookSecret
      },
      body: JSON.stringify({ update_id: 123 })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('registers configured runtime capabilities for Telegram webhooks', async () => {
    const app = createApp({
      config: {
        ...testConfig,
        scheduleCapabilityUrl: 'https://schedule.example.com/schedule/api/bot/schedule'
      },
      storage: createMemoryStorage()
    });

    const response = await app.request('/telegram/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': testConfig.telegramWebhookSecret
      },
      body: JSON.stringify({ update_id: 123 })
    });

    expect(response.status).toBe(200);
  });

  it('routes /briefing to the configured schedule capability', async () => {
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1
    });
    const fetch = vi.fn(async () =>
      Response.json({
        kind: 'reply',
        text: 'Morning briefing\n\nNormal day. No special requirements found.'
      })
    );
    vi.stubGlobal('fetch', fetch);
    const app = createApp({
      config: {
        ...testConfig,
        scheduleCapabilityUrl: 'https://schedule.example.com/schedule/api/bot/schedule'
      },
      storage,
      sendTelegramMessage: vi.fn()
    });

    const response = await app.request('/telegram/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': testConfig.telegramWebhookSecret
      },
      body: JSON.stringify({
        update_id: 123,
        message: {
          message_id: 1,
          date: 1_700_000_000,
          text: '/briefing',
          from: {
            id: 789,
            is_bot: false,
            first_name: 'Member'
          },
          chat: {
            id: 123,
            type: 'private'
          }
        }
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      dispatchResult: {
        kind: 'reply',
        text: 'Morning briefing\n\nNormal day. No special requirements found.'
      }
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://schedule.example.com/schedule/api/bot/schedule',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"command":"briefing"'),
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('does not expose the retired /meals capability when Convex is configured', async () => {
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1
    });
    const app = createApp({
      config: testConfig,
      storage,
      sendTelegramMessage: vi.fn()
    });

    const response = await app.request('/telegram/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': testConfig.telegramWebhookSecret
      },
      body: JSON.stringify({
        update_id: 123,
        message: {
          message_id: 1,
          date: 1_700_000_000,
          text: '/meals',
          from: {
            id: 789,
            is_bot: false,
            first_name: 'Member'
          },
          chat: {
            id: 123,
            type: 'private'
          }
        }
      })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      dispatchResult: {
        kind: 'reply',
        text: 'I can help with scheduling soon. Try /schedule.'
      }
    });
  });

  it('mounts notification routes', async () => {
    const app = createApp({
      config: testConfig,
      storage: createMemoryStorage()
    });

    const response = await app.request('/notifications/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  it('mounts inbound email routes', async () => {
    const captureForwardedEmail = vi.fn(async () => ({
      status: 'created' as const,
      capturedEmailId: 'captured_email_123'
    }));
    const fetch = vi.fn(async () =>
      Response.json({
        text: 'Please bring a library bag tomorrow.',
        html: '<p>Please bring a library bag tomorrow.</p>'
      })
    );
    vi.stubGlobal('fetch', fetch);
    const app = createApp({
      config: testConfig,
      storage: createMemoryStorage(),
      captureForwardedEmail
    });

    const response = await app.request('/inbound-email/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1782816900',
        'svix-signature': 'v1,invalid'
      },
      body: JSON.stringify({
        type: 'email.received',
        data: {
          email_id: 'resend-email-123',
          from: 'Forwarder <forwarder@example.com>',
          to: ['triage@example.com'],
          subject: 'Library bag tomorrow',
          created_at: '2026-06-30T08:15:00.000Z'
        }
      })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_signature' });
  });

  it('does not mount the old schedule reminder cron route', async () => {
    const app = createApp({
      config: testConfig,
      storage: createMemoryStorage()
    });

    const response = await app.request('/reminders/schedule/run', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ nowMs: Date.parse('2026-06-06T10:00:00.000Z') })
    });

    expect(response.status).toBe(404);
  });
});
