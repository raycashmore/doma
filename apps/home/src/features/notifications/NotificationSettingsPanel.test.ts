import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import NotificationSettingsPanel from './NotificationSettingsPanel.vue';

describe('NotificationSettingsPanel', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads a linked Telegram account and disconnects it', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ pairingEnabled: true, linked: true, provider: 'telegram', displayLabel: 'household_user' })
      )
      .mockResolvedValueOnce(Response.json({ status: 'unlinked' }));
    vi.stubGlobal('fetch', fetch);

    render(NotificationSettingsPanel, { props: { getToken: async () => 'session-token' } });

    expect(await screen.findByText('Telegram connected')).not.toBeNull();
    expect(screen.getByText('Linked account: @household_user')).not.toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Disconnect Telegram' }));
    expect(await screen.findByRole('button', { name: 'Create code' })).not.toBeNull();
  });

  it('creates a pairing link for an unlinked account', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ pairingEnabled: true, linked: false }))
      .mockResolvedValueOnce(
        Response.json({ deepLink: 'https://t.me/example_bot?start=generic', expiresAt: Date.now() + 60_000 })
      );
    vi.stubGlobal('fetch', fetch);

    render(NotificationSettingsPanel, { props: { getToken: async () => 'session-token' } });

    await fireEvent.click(await screen.findByRole('button', { name: 'Create code' }));
    expect((await screen.findByRole('link', { name: 'Open Telegram' })).getAttribute('href')).toBe(
      'https://t.me/example_bot?start=generic'
    );
  });

  it('refreshes link status and exposes a recoverable loading error', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Connection interrupted'))
      .mockResolvedValueOnce(Response.json({ pairingEnabled: true, linked: false }));
    vi.stubGlobal('fetch', fetch);

    render(NotificationSettingsPanel, { props: { getToken: async () => 'session-token' } });

    expect((await screen.findByRole('alert')).textContent).toContain('Connection interrupted');
    await fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));

    expect(await screen.findByRole('button', { name: 'Create code' })).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('explains that pairing is production-only when the API disables it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ pairingEnabled: false, linked: false })));

    render(NotificationSettingsPanel, { props: { getToken: async () => 'session-token' } });

    expect(await screen.findByText('Unavailable outside production')).not.toBeNull();
    expect(screen.getByText(/disabled outside the production Doma app/i)).not.toBeNull();
  });
});
