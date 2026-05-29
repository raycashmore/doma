import { createHash, randomBytes } from 'node:crypto';
import type { BotStorage } from '../storage/index.js';

const pairingTokenTtlMs = 10 * 60 * 1_000;

function hashPairingToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreatePairingTokenOptions {
  storage: BotStorage;
  clerkUserId: string;
  telegramBotUsername: string;
  now?: number;
}

export interface ConsumePairingTokenOptions {
  storage: BotStorage;
  token: string;
  now?: number;
}

export async function createPairingToken({
  storage,
  clerkUserId,
  telegramBotUsername,
  now = Date.now()
}: CreatePairingTokenOptions) {
  const token = randomBytes(24).toString('base64url');
  const expiresAt = now + pairingTokenTtlMs;

  await storage.savePairingToken({
    tokenHash: hashPairingToken(token),
    clerkUserId,
    createdAt: now,
    expiresAt
  });

  const deepLink = new URL('https://t.me/');
  deepLink.pathname = telegramBotUsername;
  deepLink.searchParams.set('start', token);

  return {
    token,
    deepLink: deepLink.toString(),
    expiresAt
  };
}

export async function consumePairingToken({
  storage,
  token,
  now = Date.now()
}: ConsumePairingTokenOptions) {
  const record = await storage.consumePairingToken(
    hashPairingToken(token),
    now
  );

  return record ? { clerkUserId: record.clerkUserId } : null;
}
