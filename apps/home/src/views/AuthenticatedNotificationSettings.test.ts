import { cleanup, fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AuthenticatedNotificationSettings from './AuthenticatedNotificationSettings.vue';

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  signOut: vi.fn()
}));

vi.mock('@clerk/vue', () => ({
  useAuth: () => ({ getToken: { value: mocks.getToken } }),
  useClerk: () => ({ value: { signOut: mocks.signOut } })
}));

describe('AuthenticatedNotificationSettings', () => {
  afterEach(() => {
    cleanup();
    mocks.getToken.mockReset();
    mocks.signOut.mockReset();
    vi.unstubAllGlobals();
  });

  it('offers Clerk sign-out from an Account card', async () => {
    mocks.getToken.mockResolvedValue('session-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ pairingEnabled: false, linked: false })));

    render(AuthenticatedNotificationSettings);

    expect(await screen.findByRole('heading', { name: 'Account' })).not.toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(mocks.signOut).toHaveBeenCalledWith({ redirectUrl: '/' });
  });
});
