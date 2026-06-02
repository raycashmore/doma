import { afterEach, describe, expect, it, vi } from 'vitest';

import { authenticateClerkRequest } from '../auth/clerk.js';
import type { BotConfig } from '../config.js';
import { createMemoryStorage } from '../storage/memory.js';
import { consumePairingToken } from './pairing.js';
import { createLinkingRoutes } from './routes.js';

vi.mock('../auth/clerk.js', () => ({
  authenticateClerkRequest: vi.fn()
}));

const config: BotConfig = {
  clerkSecretKey: 'clerk-secret-key',
  clerkPublishableKey: 'clerk-publishable-key',
  botServiceToken: 'service-token',
  pairingEnabled: true,
  telegramBotToken: 'telegram-bot-token',
  telegramWebhookSecret: 'telegram-webhook-secret',
  telegramBotUsername: 'doma_bot',
  upstashRedisRestUrl: 'https://upstash.example.com',
  upstashRedisRestToken: 'upstash-token',
  appOrigin: 'https://app.example.com'
};

const authenticateClerkRequestMock = vi.mocked(authenticateClerkRequest);

describe('linking routes', () => {
  afterEach(() => {
    authenticateClerkRequestMock.mockReset();
    vi.useRealTimers();
  });

  it('returns unauthorized for unauthenticated pairing token requests', async () => {
    authenticateClerkRequestMock.mockResolvedValueOnce(null);
    const routes = createLinkingRoutes({
      config,
      storage: createMemoryStorage()
    });

    const response = await routes.request('/pairing-token', { method: 'POST' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  it('creates a pairing token for the authenticated Clerk user', async () => {
    authenticateClerkRequestMock.mockResolvedValueOnce({ userId: 'user_123' });
    const storage = createMemoryStorage();
    const routes = createLinkingRoutes({ config, storage });

    const response = await routes.request('/pairing-token', { method: 'POST' });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toMatchObject({
      deepLink: `https://t.me/doma_bot?start=${body.token}`
    });
    await expect(consumePairingToken({ storage, token: body.token })).resolves.toEqual({ clerkUserId: 'user_123' });
  });

  it('rejects pairing token requests when pairing is disabled', async () => {
    authenticateClerkRequestMock.mockResolvedValueOnce({ userId: 'user_123' });
    const storage = createMemoryStorage();
    const routes = createLinkingRoutes({
      config: { ...config, pairingEnabled: false },
      storage
    });

    const response = await routes.request('/pairing-token', { method: 'POST' });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'pairing_disabled' });
  });

  it('returns unauthorized for unauthenticated unlink requests', async () => {
    authenticateClerkRequestMock.mockResolvedValueOnce(null);
    const storage = createMemoryStorage();
    const revokeChannelLink = vi.spyOn(storage, 'revokeChannelLink');
    const routes = createLinkingRoutes({ config, storage });

    const response = await routes.request('/unlink', { method: 'POST' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(revokeChannelLink).not.toHaveBeenCalled();
  });

  it('revokes the Telegram link for the authenticated Clerk user', async () => {
    vi.setSystemTime(1_700_000_000_000);
    authenticateClerkRequestMock.mockResolvedValueOnce({ userId: 'user_123' });
    const storage = createMemoryStorage();
    const revokeChannelLink = vi.spyOn(storage, 'revokeChannelLink');
    const routes = createLinkingRoutes({ config, storage });

    const response = await routes.request('/unlink', { method: 'POST' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(revokeChannelLink).toHaveBeenCalledWith('user_123', 'telegram', 1_700_000_000_000);
  });

  it('returns disabled link status when pairing is unavailable', async () => {
    authenticateClerkRequestMock.mockResolvedValueOnce({ userId: 'user_123' });
    const routes = createLinkingRoutes({
      config: { ...config, pairingEnabled: false },
      storage: createMemoryStorage()
    });

    const response = await routes.request('/status');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      linked: false,
      pairingEnabled: false
    });
  });

  it('returns the current Telegram link status for the authenticated user', async () => {
    authenticateClerkRequestMock.mockResolvedValueOnce({ userId: 'user_123' });
    const storage = createMemoryStorage();
    await storage.upsertChannelLink({
      clerkUserId: 'user_123',
      provider: 'telegram',
      providerUserId: 'telegram-user-123',
      providerChatId: 'telegram-chat-123',
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
      displayLabel: 'ray_cashmore'
    });
    const routes = createLinkingRoutes({
      config: { ...config, pairingEnabled: true },
      storage
    });

    const response = await routes.request('/status');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      linked: true,
      pairingEnabled: true,
      provider: 'telegram',
      displayLabel: 'ray_cashmore'
    });
  });
});
