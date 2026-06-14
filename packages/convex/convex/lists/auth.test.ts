import { describe, expect, it } from 'vitest';

import { readAuthStatus } from './auth';

function createAuthCtx(identity: { tokenIdentifier: string; subject: string } | null) {
  return {
    auth: {
      getUserIdentity: async () => identity
    }
  };
}

describe('readAuthStatus', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(readAuthStatus(createAuthCtx(null))).rejects.toThrow('Not authenticated');
  });

  it('returns a generic household user marker for authenticated callers', async () => {
    await expect(
      readAuthStatus(createAuthCtx({ tokenIdentifier: 'clerk|user_123', subject: 'user_123' }))
    ).resolves.toEqual({
      isAuthenticated: true,
      userLabel: 'Household user'
    });
  });
});
