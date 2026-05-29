import { describe, expect, it, vi } from 'vitest';
import { createUpstashStorageFromClient } from './upstash.js';

type RedisDouble = Parameters<typeof createUpstashStorageFromClient>[0] & {
  store: Map<string, unknown>;
};

function createRedisDouble(): RedisDouble {
  const store = new Map<string, unknown>();

  return {
    store,
    setex: vi.fn(async (key: string, _ttl: number, value: unknown) => {
      store.set(key, value);
      return 'OK';
    }),
    async get<TData>(key: string) {
      return (store.get(key) as TData | undefined) ?? null;
    },
    async getdel<TData>(key: string) {
      const value = (store.get(key) as TData | undefined) ?? null;
      store.delete(key);
      return value;
    },
    del: vi.fn(async (key: string) => {
      return store.delete(key) ? 1 : 0;
    }),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return 'OK';
    }),
  };
}

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

  it('does not return stale canonical clerk-user links for outbound lookup', async () => {
    const redis = createRedisDouble();
    const storage = createUpstashStorageFromClient(redis);
    const firstLink = {
      clerkUserId: 'user_a',
      provider: 'telegram' as const,
      providerUserId: 'telegram-user-p',
      providerChatId: 'telegram-chat-a',
      status: 'active' as const,
      createdAt: 1_000,
      updatedAt: 1_000,
    };
    const secondLink = {
      ...firstLink,
      clerkUserId: 'user_b',
      providerChatId: 'telegram-chat-b',
      updatedAt: 2_000,
    };

    redis.store.set('bot:channel-link:user:telegram:user_a', firstLink);
    redis.store.set('bot:channel-link:user:telegram:user_b', secondLink);
    redis.store.set('bot:channel-link:provider-user:telegram:telegram-user-p', {
      clerkUserId: 'user_b',
      provider: 'telegram',
    });

    await expect(
      storage.getActiveChannelLinkForUser('user_a', 'telegram')
    ).resolves.toBeNull();
    await expect(
      storage.getActiveChannelLinkForUser('user_b', 'telegram')
    ).resolves.toEqual(secondLink);
    await expect(
      storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-p')
    ).resolves.toEqual(secondLink);
  });

  it('replaces provider-user links for the same clerk user through storage operations', async () => {
    const redis = createRedisDouble();
    const storage = createUpstashStorageFromClient(redis);
    const firstLink = {
      clerkUserId: 'user_123',
      provider: 'telegram' as const,
      providerUserId: 'telegram-user-a',
      providerChatId: 'telegram-chat-a',
      status: 'active' as const,
      createdAt: 1_000,
      updatedAt: 1_000,
    };
    const secondLink = {
      ...firstLink,
      providerUserId: 'telegram-user-b',
      providerChatId: 'telegram-chat-b',
      updatedAt: 2_000,
    };

    await storage.upsertChannelLink(firstLink);
    await storage.upsertChannelLink(secondLink);

    await expect(
      storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-a')
    ).resolves.toBeNull();
    await expect(
      storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-b')
    ).resolves.toEqual(secondLink);
    await expect(
      storage.getActiveChannelLinkForUser('user_123', 'telegram')
    ).resolves.toEqual(secondLink);
  });

  it('removes the previous clerk user link when a provider user relinks through storage operations', async () => {
    const redis = createRedisDouble();
    const storage = createUpstashStorageFromClient(redis);
    const firstLink = {
      clerkUserId: 'user_a',
      provider: 'telegram' as const,
      providerUserId: 'telegram-user-p',
      providerChatId: 'telegram-chat-a',
      status: 'active' as const,
      createdAt: 1_000,
      updatedAt: 1_000,
    };
    const secondLink = {
      ...firstLink,
      clerkUserId: 'user_b',
      providerChatId: 'telegram-chat-b',
      updatedAt: 2_000,
    };

    await storage.upsertChannelLink(firstLink);
    await storage.upsertChannelLink(secondLink);

    await expect(
      storage.getActiveChannelLinkForUser('user_a', 'telegram')
    ).resolves.toBeNull();
    await expect(
      storage.getActiveChannelLinkForUser('user_b', 'telegram')
    ).resolves.toEqual(secondLink);
    await expect(
      storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-p')
    ).resolves.toEqual(secondLink);
  });
});
