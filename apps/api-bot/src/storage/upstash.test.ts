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

  it('revalidates provider-user links against the canonical clerk-user link', async () => {
    const canonicalLink = {
      clerkUserId: 'user_123',
      provider: 'telegram' as const,
      providerUserId: 'telegram-user-b',
      providerChatId: 'telegram-chat-b',
      status: 'active' as const,
      createdAt: 1_000,
      updatedAt: 2_000,
    };
    const redis = {
      setex: vi.fn(),
      get: vi
        .fn()
        .mockImplementation(
          async (
            key: string
          ): Promise<
            | { clerkUserId: string; provider: 'telegram' }
            | typeof canonicalLink
            | null
          > => {
            if (
              key ===
                'bot:channel-link:provider-user:telegram:telegram-user-a' ||
              key ===
                'bot:channel-link:provider-user:telegram:telegram-user-b'
            ) {
              return { clerkUserId: 'user_123', provider: 'telegram' };
            }

            if (key === 'bot:channel-link:user:telegram:user_123') {
              return canonicalLink;
            }

            return null;
          }
        ),
      getdel: vi.fn(),
      del: vi.fn(),
      set: vi.fn(),
    };

    const storage = createUpstashStorageFromClient(redis);

    await expect(
      storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-a')
    ).resolves.toBeNull();
    await expect(
      storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-b')
    ).resolves.toEqual(canonicalLink);
  });
});
