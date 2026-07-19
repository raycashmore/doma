import { describe, expect, it, vi } from 'vitest';

import { createNotificationClient } from './notificationClient';

describe('notification client', () => {
  it('loads Telegram link status with the Clerk bearer token', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ pairingEnabled: true, linked: true, provider: 'telegram', displayLabel: 'household_user' })
    );
    const client = createNotificationClient({ getToken: async () => 'session-token', fetch });

    await expect(client.fetchLinkStatus()).resolves.toEqual({
      pairingEnabled: true,
      linked: true,
      provider: 'telegram',
      displayLabel: 'household_user'
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/bot/linking/status',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer session-token' })
      })
    );
  });

  it('creates a Telegram pairing link and unlinks through the existing bot routes', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ deepLink: 'https://t.me/example_bot?start=generic', expiresAt: 1234 }))
      .mockResolvedValueOnce(Response.json({ status: 'unlinked' }));
    const client = createNotificationClient({ getToken: async () => 'session-token', fetch });

    await expect(client.createPairingLink()).resolves.toEqual({
      deepLink: 'https://t.me/example_bot?start=generic',
      expiresAt: 1234
    });
    await expect(client.unlinkTelegram()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/bot/linking/pairing-token',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/bot/linking/unlink', expect.objectContaining({ method: 'POST' }));
  });

  it('preserves the production-only pairing error', async () => {
    const fetch = vi.fn(async () => Response.json({ error: 'pairing_disabled' }, { status: 403 }));
    const client = createNotificationClient({ getToken: async () => 'session-token', fetch });

    await expect(client.fetchLinkStatus()).rejects.toThrow(
      'Telegram pairing is only available in the production Doma app.'
    );
  });
});
