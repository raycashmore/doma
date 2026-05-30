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

type ChannelLinkPointer = {
  clerkUserId: string;
  provider: ProviderName;
};

type UpstashStorageClient = {
  setex<TData>(key: string, ttl: number, value: TData): Promise<string>;
  get<TData>(key: string): Promise<TData | null>;
  getdel<TData>(key: string): Promise<TData | null>;
  del(key: string): Promise<number>;
  set<TData>(key: string, value: TData): Promise<unknown>;
};

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
      const existingByProviderUser = await redis.get<ChannelLinkPointer>(
        providerUserKey
      );

      if (
        existingByProviderUser &&
        existingByProviderUser.clerkUserId !== record.clerkUserId
      ) {
        const existingProviderUserKey = channelLinkUserKey(
          existingByProviderUser.clerkUserId,
          existingByProviderUser.provider
        );
        const existingProviderUserRecord =
          await redis.get<ChannelLinkRecord>(existingProviderUserKey);

        if (
          isActiveProviderUserLink(
            existingProviderUserRecord,
            record.provider,
            record.providerUserId
          )
        ) {
          await redis.del(existingProviderUserKey);
        }
      }

      if (existingByUser) {
        await redis.del(
          channelLinkProviderUserKey(
            existingByUser.provider,
            existingByUser.providerUserId
          )
        );
      }

      await redis.set(userKey, record);
      await redis.set<ChannelLinkPointer>(providerUserKey, {
        clerkUserId: record.clerkUserId,
        provider: record.provider,
      });
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
      await redis.del(
        channelLinkProviderUserKey(provider, record.providerUserId)
      );
    },

    async getActiveChannelLinkForUser(clerkUserId, provider) {
      const record = await redis.get<ChannelLinkRecord>(
        channelLinkUserKey(clerkUserId, provider)
      );
      const pointer = record
        ? await redis.get<ChannelLinkPointer>(
            channelLinkProviderUserKey(record.provider, record.providerUserId)
          )
        : null;

      return isActiveClerkUserLink(record, clerkUserId, provider) &&
        pointer?.clerkUserId === clerkUserId &&
        pointer.provider === provider
        ? record
        : null;
    },

    async getActiveChannelLinkByProviderUser(provider, providerUserId) {
      const pointer = await redis.get<ChannelLinkPointer>(
        channelLinkProviderUserKey(provider, providerUserId)
      );
      const record = pointer
        ? await redis.get<ChannelLinkRecord>(
            channelLinkUserKey(pointer.clerkUserId, pointer.provider)
          )
        : null;

      return isActiveProviderUserLink(record, provider, providerUserId)
        ? record
        : null;
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
