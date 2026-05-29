import { Redis } from '@upstash/redis';
import type { BotConfig } from '../config.js';
import type {
  BotStorage,
  ChannelLinkRecord,
  NotificationAttemptRecord,
  PairingTokenRecord,
  ProviderName,
} from './types.js';

const notificationAttemptTtlSeconds = 30 * 24 * 60 * 60;

function pairingTokenKey(tokenHash: string) {
  return `bot:pairing-token:${tokenHash}`;
}

function channelLinkUserKey(clerkUserId: string, provider: ProviderName) {
  return `bot:channel-link:user:${provider}:${clerkUserId}`;
}

function channelLinkProviderUserKey(
  provider: ProviderName,
  providerUserId: string
) {
  return `bot:channel-link:provider-user:${provider}:${providerUserId}`;
}

function notificationAttemptKey(id: string) {
  return `bot:notification-attempt:${id}`;
}

function ttlSecondsUntil(expiresAt: number, now = Date.now()) {
  return Math.max(1, Math.ceil((expiresAt - now) / 1_000));
}

interface UpstashStorageClient {
  setex<TData>(key: string, ttl: number, value: TData): Promise<string>;
  get<TData>(key: string): Promise<TData | null>;
  getdel<TData>(key: string): Promise<TData | null>;
  del(key: string): Promise<number>;
  set<TData>(key: string, value: TData): Promise<unknown>;
}

export function createUpstashStorage(config: BotConfig): BotStorage {
  const redis = new Redis({
    url: config.upstashRedisRestUrl,
    token: config.upstashRedisRestToken,
  });

  return createUpstashStorageFromClient(redis);
}

export function createUpstashStorageFromClient(
  redis: UpstashStorageClient
): BotStorage {
  return {
    async savePairingToken(record) {
      await redis.setex(
        pairingTokenKey(record.tokenHash),
        ttlSecondsUntil(record.expiresAt),
        record
      );
    },

    async consumePairingToken(tokenHash, now = Date.now()) {
      const record = await redis.getdel<PairingTokenRecord>(
        pairingTokenKey(tokenHash)
      );

      if (!record || record.expiresAt <= now) {
        return null;
      }

      return record;
    },

    async upsertChannelLink(record) {
      const userKey = channelLinkUserKey(record.clerkUserId, record.provider);
      const providerUserKey = channelLinkProviderUserKey(
        record.provider,
        record.providerUserId
      );
      const existingByUser = await redis.get<ChannelLinkRecord>(
        userKey
      );
      const existingByProviderUser = await redis.get<ChannelLinkRecord>(
        providerUserKey
      );

      if (existingByUser) {
        await redis.del(
          channelLinkProviderUserKey(
            existingByUser.provider,
            existingByUser.providerUserId
          )
        );
      }

      if (existingByProviderUser) {
        await redis.del(
          channelLinkUserKey(
            existingByProviderUser.clerkUserId,
            existingByProviderUser.provider
          )
        );
      }

      await redis.set(userKey, record);
      await redis.set(providerUserKey, record);
    },

    async revokeChannelLink(clerkUserId, provider, now = Date.now()) {
      const userKey = channelLinkUserKey(clerkUserId, provider);
      const record = await redis.get<ChannelLinkRecord>(userKey);

      if (!record) {
        return;
      }

      const revokedRecord: ChannelLinkRecord = {
        ...record,
        status: 'revoked',
        updatedAt: now,
      };

      await redis.set(userKey, revokedRecord);
      await redis.set(
        channelLinkProviderUserKey(provider, record.providerUserId),
        revokedRecord
      );
    },

    async getActiveChannelLinkForUser(clerkUserId, provider) {
      const record = await redis.get<ChannelLinkRecord>(
        channelLinkUserKey(clerkUserId, provider)
      );

      return record?.status === 'active' ? record : null;
    },

    async getActiveChannelLinkByProviderUser(provider, providerUserId) {
      const record = await redis.get<ChannelLinkRecord>(
        channelLinkProviderUserKey(provider, providerUserId)
      );

      return record?.status === 'active' ? record : null;
    },

    async saveNotificationAttempt(record: NotificationAttemptRecord) {
      await redis.setex(
        notificationAttemptKey(record.id),
        notificationAttemptTtlSeconds,
        record
      );
    },
  };
}
