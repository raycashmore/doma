import { describe, expect, it, vi } from 'vitest';
import type { BotConfig } from './config.js';
import { authenticateClerkRequest } from './auth/clerk.js';
import { createApp } from './app.js';
import { createMemoryStorage } from './storage/memory.js';

vi.mock('./auth/clerk.js', () => ({
  authenticateClerkRequest: vi.fn()
}));

const testConfig: BotConfig = {
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

describe('api-bot app', () => {
  it('returns health status', async () => {
    const app = createApp({
      config: testConfig,
      storage: createMemoryStorage()
    });

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
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
});
