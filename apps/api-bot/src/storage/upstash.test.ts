import { describe, expect, it, vi } from 'vitest';
import { createUpstashStorageFromClient } from './upstash.js';

describe('createUpstashStorageFromClient', () => {
  it('atomically consumes pairing tokens with getdel', async () => {
    const token = {
      tokenHash: 'token-hash',
      clerkUserId: 'user_123',
      expiresAt: 2_000,
      createdAt: 1_000,
    };
    const redis = {
      setex: vi.fn(),
      get: vi.fn(),
      getdel: vi.fn().mockResolvedValue(token),
      del: vi.fn(),
      set: vi.fn(),
    };

    const storage = createUpstashStorageFromClient(redis);

    await expect(storage.consumePairingToken('token-hash', 1_500)).resolves.toEqual(
      token
    );
    expect(redis.getdel).toHaveBeenCalledWith('bot:pairing-token:token-hash');
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('returns null for missing or expired pairing tokens consumed by getdel', async () => {
    const redis = {
      setex: vi.fn(),
      get: vi.fn(),
      getdel: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          tokenHash: 'expired-token-hash',
          clerkUserId: 'user_123',
          expiresAt: 2_000,
          createdAt: 1_000,
        }),
      del: vi.fn(),
      set: vi.fn(),
    };

    const storage = createUpstashStorageFromClient(redis);

    await expect(storage.consumePairingToken('missing-token-hash')).resolves.toBeNull();
    await expect(
      storage.consumePairingToken('expired-token-hash', 2_000)
    ).resolves.toBeNull();
    expect(redis.del).not.toHaveBeenCalled();
  });
});
