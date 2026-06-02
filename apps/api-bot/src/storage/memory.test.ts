import { describe, expect, it } from 'vitest';

import { createMemoryStorage } from './memory.js';

describe('createMemoryStorage', () => {
  it('consumes pairing tokens once', async () => {
    const storage = createMemoryStorage();
    const token = {
      tokenHash: 'token-hash',
      clerkUserId: 'user_123',
      expiresAt: 2_000,
      createdAt: 1_000
    };

    await storage.savePairingToken(token);

    await expect(storage.consumePairingToken('token-hash', 1_500)).resolves.toEqual(token);
    await expect(storage.consumePairingToken('token-hash', 1_500)).resolves.toBeNull();
  });

  it('returns null for expired pairing tokens', async () => {
    const storage = createMemoryStorage();

    await storage.savePairingToken({
      tokenHash: 'expired-token-hash',
      clerkUserId: 'user_123',
      expiresAt: 2_000,
      createdAt: 1_000
    });

    await expect(storage.consumePairingToken('expired-token-hash', 2_000)).resolves.toBeNull();
  });

  it('stores active channel links by provider user and clerk user', async () => {
    const storage = createMemoryStorage();
    const link = {
      clerkUserId: 'user_123',
      provider: 'telegram' as const,
      providerUserId: 'telegram-user-123',
      providerChatId: 'telegram-chat-123',
      status: 'active' as const,
      createdAt: 1_000,
      updatedAt: 1_000,
      displayLabel: 'Primary Telegram'
    };

    await storage.upsertChannelLink(link);

    await expect(storage.getActiveChannelLinkForUser('user_123', 'telegram')).resolves.toEqual(link);
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-123')).resolves.toEqual(link);

    await storage.revokeChannelLink('user_123', 'telegram', 2_000);

    await expect(storage.getActiveChannelLinkForUser('user_123', 'telegram')).resolves.toBeNull();
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-123')).resolves.toBeNull();
  });

  it('replaces provider-user links for the same clerk user', async () => {
    const storage = createMemoryStorage();
    const firstLink = {
      clerkUserId: 'user_123',
      provider: 'telegram' as const,
      providerUserId: 'telegram-user-a',
      providerChatId: 'telegram-chat-a',
      status: 'active' as const,
      createdAt: 1_000,
      updatedAt: 1_000
    };
    const secondLink = {
      ...firstLink,
      providerUserId: 'telegram-user-b',
      providerChatId: 'telegram-chat-b',
      updatedAt: 2_000
    };

    await storage.upsertChannelLink(firstLink);
    await storage.upsertChannelLink(secondLink);

    await expect(storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-a')).resolves.toBeNull();
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-b')).resolves.toEqual(
      secondLink
    );
    await expect(storage.getActiveChannelLinkForUser('user_123', 'telegram')).resolves.toEqual(secondLink);
  });

  it('removes the previous clerk user link when a provider user relinks', async () => {
    const storage = createMemoryStorage();
    const firstLink = {
      clerkUserId: 'user_a',
      provider: 'telegram' as const,
      providerUserId: 'telegram-user-p',
      providerChatId: 'telegram-chat-a',
      status: 'active' as const,
      createdAt: 1_000,
      updatedAt: 1_000
    };
    const secondLink = {
      ...firstLink,
      clerkUserId: 'user_b',
      providerChatId: 'telegram-chat-b',
      updatedAt: 2_000
    };

    await storage.upsertChannelLink(firstLink);
    await storage.upsertChannelLink(secondLink);

    await expect(storage.getActiveChannelLinkForUser('user_a', 'telegram')).resolves.toBeNull();
    await expect(storage.getActiveChannelLinkForUser('user_b', 'telegram')).resolves.toEqual(secondLink);
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-p')).resolves.toEqual(
      secondLink
    );
  });

  it('does not return stale canonical clerk-user links for outbound lookup', async () => {
    const firstLink = {
      clerkUserId: 'user_a',
      provider: 'telegram' as const,
      providerUserId: 'telegram-user-p',
      providerChatId: 'telegram-chat-a',
      status: 'active' as const,
      createdAt: 1_000,
      updatedAt: 1_000
    };
    const secondLink = {
      ...firstLink,
      clerkUserId: 'user_b',
      providerChatId: 'telegram-chat-b',
      updatedAt: 2_000
    };
    const storage = createMemoryStorage({
      channelLinksByUser: [
        ['telegram:user_a', firstLink],
        ['telegram:user_b', secondLink]
      ],
      channelLinksByProviderUser: [['telegram:telegram-user-p', { clerkUserId: 'user_b', provider: 'telegram' }]]
    });

    await expect(storage.getActiveChannelLinkForUser('user_a', 'telegram')).resolves.toBeNull();
    await expect(storage.getActiveChannelLinkForUser('user_b', 'telegram')).resolves.toEqual(secondLink);
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-p')).resolves.toEqual(
      secondLink
    );
  });

  it('does not return stale provider-user pointers without a matching canonical link', async () => {
    const canonicalLink = {
      clerkUserId: 'user_123',
      provider: 'telegram' as const,
      providerUserId: 'telegram-user-b',
      providerChatId: 'telegram-chat-b',
      status: 'active' as const,
      createdAt: 1_000,
      updatedAt: 2_000
    };
    const storage = createMemoryStorage({
      channelLinksByUser: [['telegram:user_123', canonicalLink]],
      channelLinksByProviderUser: [
        ['telegram:telegram-user-a', { clerkUserId: 'user_123', provider: 'telegram' }],
        ['telegram:telegram-user-b', { clerkUserId: 'user_123', provider: 'telegram' }]
      ]
    });

    await expect(storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-a')).resolves.toBeNull();
    await expect(storage.getActiveChannelLinkByProviderUser('telegram', 'telegram-user-b')).resolves.toEqual(
      canonicalLink
    );
  });
});
