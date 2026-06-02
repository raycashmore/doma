import type { BotConfig } from '../config.js';
import { createUpstashStorage } from './upstash.js';

export function createRuntimeStorage(config: BotConfig) {
  return createUpstashStorage(config);
}

export type {
  BotStorage,
  ChannelLinkRecord,
  NotificationAttemptRecord,
  PairingTokenRecord,
  ProviderName
} from './types.js';
