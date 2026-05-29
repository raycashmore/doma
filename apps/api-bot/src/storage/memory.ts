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

export function createMemoryStorage(): BotStorage {
  const pairingTokens = new Map<string, PairingTokenRecord>();
  const channelLinksByUser = new Map<string, ChannelLinkRecord>();
  const channelLinksByProviderUser = new Map<string, ChannelLinkRecord>();
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

      if (existingByUser) {
        channelLinksByProviderUser.delete(
          channelLinkProviderUserKey(
            existingByUser.provider,
            existingByUser.providerUserId
          )
        );
      }

      if (existingByProviderUser) {
        channelLinksByUser.delete(
          channelLinkUserKey(
            existingByProviderUser.clerkUserId,
            existingByProviderUser.provider
          )
        );
      }

      channelLinksByUser.set(userKey, record);
      channelLinksByProviderUser.set(providerUserKey, record);
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
      channelLinksByProviderUser.set(
        channelLinkProviderUserKey(provider, record.providerUserId),
        revokedRecord
      );
    },

    async getActiveChannelLinkForUser(clerkUserId, provider) {
      const record = channelLinksByUser.get(
        channelLinkUserKey(clerkUserId, provider)
      );

      return record?.status === 'active' ? record : null;
    },

    async getActiveChannelLinkByProviderUser(provider, providerUserId) {
      const record = channelLinksByProviderUser.get(
        channelLinkProviderUserKey(provider, providerUserId)
      );

      return record?.status === 'active' ? record : null;
    },

    async saveNotificationAttempt(record) {
      notificationAttempts.set(record.id, record);
    },
  };
}
