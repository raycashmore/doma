import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadClerkSession, resolveAuthenticatedUrl } from './auth';

type ClerkWindow = Window & {
  Clerk?: unknown;
  __internal_ClerkUICtor?: unknown;
};

describe('loadClerkSession', () => {
  const load = vi.fn(async () => undefined);
  const mountSignIn = vi.fn();
  const buildUrlWithAuth = vi.fn((url: string) => `${url}?__clerk_db_jwt=session-token`);

  beforeEach(() => {
    load.mockClear();
    mountSignIn.mockClear();
    buildUrlWithAuth.mockClear();
    const clerkWindow = window as ClerkWindow;
    clerkWindow.Clerk = {
      load,
      mountSignIn,
      buildUrlWithAuth,
      user: null,
      session: null
    } as never;
    clerkWindow.__internal_ClerkUICtor = {};
  });

  it('mounts large Lists branding and returns signed-out users to the Lists zone', async () => {
    await loadClerkSession('pk_test_example', document.createElement('div'));

    expect(mountSignIn).toHaveBeenCalledWith(expect.any(HTMLDivElement), {
      forceRedirectUrl: '/lists',
      appearance: {
        elements: {
          card: {
            paddingTop: '12rem'
          },
          headerSubtitle: 'hidden',
          headerTitle: 'hidden'
        }
      }
    });
  });

  it('exposes Clerk URL authentication for cross-zone navigation', async () => {
    const clerkWindow = window as ClerkWindow;
    clerkWindow.Clerk = {
      load,
      mountSignIn,
      buildUrlWithAuth,
      user: {
        fullName: 'Household user',
        primaryEmailAddress: null
      },
      session: {
        getToken: vi.fn()
      }
    } as never;

    const authState = await loadClerkSession('pk_test_example', document.createElement('div'));

    expect(authState.status).toBe('ready');
    if (authState.status !== 'ready' || !authState.session) throw new Error('Expected an authenticated session.');

    expect(authState.session.buildUrlWithAuth('http://localhost:3001/')).toBe(
      'http://localhost:3001/?__clerk_db_jwt=session-token'
    );
  });

  it('decorates navigation URLs only when an authenticated session is ready', () => {
    const url = 'http://localhost:3001/';
    const authenticatedState = {
      status: 'ready' as const,
      session: {
        userName: 'Household user',
        buildUrlWithAuth,
        getToken: vi.fn(),
        signOut: vi.fn()
      }
    };

    expect(resolveAuthenticatedUrl(authenticatedState, url)).toBe(
      'http://localhost:3001/?__clerk_db_jwt=session-token'
    );
    expect(resolveAuthenticatedUrl({ status: 'loading' }, url)).toBe(url);
  });
});
