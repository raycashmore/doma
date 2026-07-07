import { createClerkClient } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BotConfig } from '../config.js';
import { authenticateClerkRequest } from './clerk.js';

vi.mock('@clerk/backend', () => ({
  createClerkClient: vi.fn()
}));

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

const request = new Request('https://api.example.com/me');
const createClerkClientMock = vi.mocked(createClerkClient);

function mockAuthenticateRequest(auth: { isAuthenticated: boolean; userId: string | null }) {
  const authenticateRequest = vi.fn().mockResolvedValue({
    isAuthenticated: auth.isAuthenticated,
    toAuth: () => ({ userId: auth.userId })
  });

  createClerkClientMock.mockReturnValue({
    authenticateRequest
  } as unknown as ReturnType<typeof createClerkClient>);

  return authenticateRequest;
}

describe('authenticateClerkRequest', () => {
  beforeEach(() => {
    createClerkClientMock.mockReset();
  });

  it('passes Clerk keys and authorized parties when authenticating', async () => {
    const authenticateRequest = mockAuthenticateRequest({
      isAuthenticated: true,
      userId: 'user_123'
    });

    await authenticateClerkRequest(request, config);

    expect(createClerkClientMock).toHaveBeenCalledWith({
      secretKey: 'clerk-secret-key',
      publishableKey: 'clerk-publishable-key'
    });
    expect(authenticateRequest).toHaveBeenCalledWith(request, {
      authorizedParties: ['https://app.example.com']
    });
  });

  it('returns the Clerk user id when authenticated', async () => {
    mockAuthenticateRequest({ isAuthenticated: true, userId: 'user_123' });

    await expect(authenticateClerkRequest(request, config)).resolves.toEqual({
      userId: 'user_123'
    });
  });

  it('returns null when the request is unauthenticated', async () => {
    mockAuthenticateRequest({ isAuthenticated: false, userId: null });

    await expect(authenticateClerkRequest(request, config)).resolves.toBeNull();
  });

  it('returns null when authenticated auth has no user id', async () => {
    mockAuthenticateRequest({ isAuthenticated: true, userId: null });

    await expect(authenticateClerkRequest(request, config)).resolves.toBeNull();
  });
});
