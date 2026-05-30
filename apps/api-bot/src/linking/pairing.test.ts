import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/memory.js';
import { consumePairingToken, createPairingToken } from './pairing.js';

describe('pairing tokens', () => {
  it('creates a Telegram deep link and consumes the token once', async () => {
    const storage = createMemoryStorage();
    const now = 1_700_000_000_000;

    const pairing = await createPairingToken({
      storage,
      clerkUserId: 'user_123',
      telegramBotUsername: 'doma_bot',
      now
    });

    expect(pairing.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(pairing.deepLink).toBe(
      `https://t.me/doma_bot?start=${pairing.token}`
    );
    expect(pairing.expiresAt).toBe(now + 10 * 60 * 1_000);

    await expect(
      consumePairingToken({ storage, token: pairing.token, now })
    ).resolves.toEqual({ clerkUserId: 'user_123' });
    await expect(
      consumePairingToken({ storage, token: pairing.token, now })
    ).resolves.toBeNull();
  });
});
