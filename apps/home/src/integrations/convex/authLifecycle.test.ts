import { describe, expect, it, vi } from 'vitest';

import { createConvexAuthLifecycle } from './authLifecycle';

describe('Convex auth lifecycle', () => {
  it('installs a Clerk token fetcher that honors forced refresh', async () => {
    const getToken = vi.fn(async () => 'session-token');
    const setAuth = vi.fn();
    const lifecycle = createConvexAuthLifecycle({ setAuth });

    lifecycle.update({ isLoaded: true, isSignedIn: true, getToken });

    expect(setAuth).toHaveBeenCalledOnce();
    const fetchToken = setAuth.mock.calls[0]?.[0];
    await expect(fetchToken?.({ forceRefreshToken: true })).resolves.toBe('session-token');
    expect(getToken).toHaveBeenCalledWith({ template: 'convex', skipCache: true });
  });

  it('clears browser-client auth with a null token fetcher on sign-out and disposal', async () => {
    const setAuth = vi.fn();
    const lifecycle = createConvexAuthLifecycle({ setAuth });
    const getToken = vi.fn(async () => 'session-token');

    lifecycle.update({ isLoaded: true, isSignedIn: true, getToken });
    lifecycle.update({ isLoaded: true, isSignedIn: false, getToken });
    lifecycle.dispose();

    expect(setAuth).toHaveBeenCalledTimes(3);
    await expect(setAuth.mock.calls[1]?.[0]?.({ forceRefreshToken: false })).resolves.toBeNull();
    await expect(setAuth.mock.calls[2]?.[0]?.({ forceRefreshToken: false })).resolves.toBeNull();
  });

  it('does not touch Convex before Clerk has loaded', () => {
    const setAuth = vi.fn();
    const lifecycle = createConvexAuthLifecycle({ setAuth });

    lifecycle.update({
      isLoaded: false,
      isSignedIn: undefined,
      getToken: vi.fn(async () => null)
    });

    expect(setAuth).not.toHaveBeenCalled();
  });
});
