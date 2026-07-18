import { createClerkClient } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentConfig } from '../config.js';
import { authenticateClerkRequest } from './clerk.js';

vi.mock('@clerk/backend', () => ({ createClerkClient: vi.fn() }));

const config = {
  appOrigin: 'https://app.example.com',
  clerkPublishableKey: 'clerk-publishable-key',
  clerkSecretKey: 'clerk-secret-key'
} as AgentConfig;
const request = new Request('https://agent.example.com/api/weekly-meals');
const createClerkClientMock = vi.mocked(createClerkClient);

function mockAuthentication(isAuthenticated: boolean, userId: string | null) {
  const authenticateRequest = vi.fn().mockResolvedValue({
    isAuthenticated,
    toAuth: () => ({ userId })
  });
  createClerkClientMock.mockReturnValue({ authenticateRequest } as unknown as ReturnType<typeof createClerkClient>);
  return authenticateRequest;
}

describe('authenticateClerkRequest', () => {
  beforeEach(() => createClerkClientMock.mockReset());

  it('binds authentication to the configured Clerk application and origin', async () => {
    const authenticateRequest = mockAuthentication(true, 'user_123');

    await expect(authenticateClerkRequest(request, config)).resolves.toEqual({ userId: 'user_123' });
    expect(createClerkClientMock).toHaveBeenCalledWith({
      publishableKey: 'clerk-publishable-key',
      secretKey: 'clerk-secret-key'
    });
    expect(authenticateRequest).toHaveBeenCalledWith(request, {
      authorizedParties: ['https://app.example.com']
    });
  });

  it.each([
    { isAuthenticated: false, userId: null },
    { isAuthenticated: true, userId: null }
  ])('returns null without an authenticated user id', async ({ isAuthenticated, userId }) => {
    mockAuthentication(isAuthenticated, userId);

    await expect(authenticateClerkRequest(request, config)).resolves.toBeNull();
  });
});
