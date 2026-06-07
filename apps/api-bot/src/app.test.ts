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
