import type {
  BotStorage,
  ChannelLinkRecord,
  NotificationAttemptRecord,
  PairingTokenRecord,
  ProviderName,
} from './types.js';

function channelLinkUserKey(clerkUserId: string, provider: ProviderName) {
  return `${provider}:${clerkUserId}`;
}

function channelLinkProviderUserKey(
  provider: ProviderName,
  providerUserId: string
) {
  return `${provider}:${providerUserId}`;
}

interface ChannelLinkPointer {
  clerkUserId: string;
  provider: ProviderName;
}

function isActiveProviderUserLink(
  record: ChannelLinkRecord | null,
  provider: ProviderName,
  providerUserId: string
) {
  return (
    record?.status === 'active' &&
    record.provider === provider &&
    record.providerUserId === providerUserId
  );
}

function isActiveClerkUserLink(
  record: ChannelLinkRecord | null,
  clerkUserId: string,
  provider: ProviderName
) {
  return (
    record?.status === 'active' &&
    record.clerkUserId === clerkUserId &&
    record.provider === provider
  );
}

export interface MemoryStorageSeed {
  channelLinksByUser?: Iterable<[string, ChannelLinkRecord]>;
  channelLinksByProviderUser?: Iterable<[string, ChannelLinkPointer]>;
}

export function createMemoryStorage(seed: MemoryStorageSeed = {}): BotStorage {
  const pairingTokens = new Map<string, PairingTokenRecord>();
  const channelLinksByUser = new Map<string, ChannelLinkRecord>(
    seed.channelLinksByUser
  );
  const channelLinksByProviderUser = new Map<string, ChannelLinkPointer>(
    seed.channelLinksByProviderUser
  );
  const notificationAttempts = new Map<string, NotificationAttemptRecord>();

  return {
    async savePairingToken(record) {
      pairingTokens.set(record.tokenHash, record);
    },

    async consumePairingToken(tokenHash, now = Date.now()) {
      const record = pairingTokens.get(tokenHash);
      pairingTokens.delete(tokenHash);

      if (!record || record.expiresAt <= now) {
        return null;
      }

      return record;
    },

    async upsertChannelLink(record) {
      const userKey = channelLinkUserKey(record.clerkUserId, record.provider);
      const existingByUser = channelLinksByUser.get(userKey);
      const providerUserKey = channelLinkProviderUserKey(
        record.provider,
        record.providerUserId
      );
      const existingByProviderUser =
        channelLinksByProviderUser.get(providerUserKey);

      if (
        existingByProviderUser &&
        existingByProviderUser.clerkUserId !== record.clerkUserId
      ) {
        const existingProviderUserKey = channelLinkUserKey(
          existingByProviderUser.clerkUserId,
          existingByProviderUser.provider
        );
        const existingProviderUserRecord = channelLinksByUser.get(
          existingProviderUserKey
        );

        if (
          isActiveProviderUserLink(
            existingProviderUserRecord ?? null,
            record.provider,
            record.providerUserId
          )
        ) {
          channelLinksByUser.delete(existingProviderUserKey);
        }
      }

      if (existingByUser) {
        channelLinksByProviderUser.delete(
          channelLinkProviderUserKey(
            existingByUser.provider,
            existingByUser.providerUserId
          )
        );
      }

      channelLinksByUser.set(userKey, record);
      channelLinksByProviderUser.set(providerUserKey, {
        clerkUserId: record.clerkUserId,
        provider: record.provider,
      });
    },

    async revokeChannelLink(clerkUserId, provider, now = Date.now()) {
      const userKey = channelLinkUserKey(clerkUserId, provider);
      const record = channelLinksByUser.get(userKey);

      if (!record) {
        return;
      }

      const revokedRecord: ChannelLinkRecord = {
        ...record,
        status: 'revoked',
        updatedAt: now,
      };

      channelLinksByUser.set(userKey, revokedRecord);
      channelLinksByProviderUser.delete(
        channelLinkProviderUserKey(provider, record.providerUserId)
      );
    },

    async getActiveChannelLinkForUser(clerkUserId, provider) {
      const record =
        channelLinksByUser.get(channelLinkUserKey(clerkUserId, provider)) ??
        null;
      const pointer = record
        ? channelLinksByProviderUser.get(
            channelLinkProviderUserKey(record.provider, record.providerUserId)
          )
        : null;

      return isActiveClerkUserLink(record ?? null, clerkUserId, provider) &&
        pointer?.clerkUserId === clerkUserId &&
        pointer.provider === provider
        ? record
        : null;
    },

    async getActiveChannelLinkByProviderUser(provider, providerUserId) {
      const pointer = channelLinksByProviderUser.get(
        channelLinkProviderUserKey(provider, providerUserId)
      );
      const record = pointer
        ? (channelLinksByUser.get(
            channelLinkUserKey(pointer.clerkUserId, pointer.provider)
          ) ?? null)
        : null;

      return isActiveProviderUserLink(record, provider, providerUserId)
        ? record
        : null;
    },

    async saveNotificationAttempt(record) {
      notificationAttempts.set(record.id, record);
    },
  };
}
