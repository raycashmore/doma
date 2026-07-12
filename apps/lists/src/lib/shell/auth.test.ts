import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadClerkSession } from './auth';

type ClerkWindow = Window & {
  Clerk?: unknown;
  __internal_ClerkUICtor?: unknown;
};

describe('loadClerkSession', () => {
  const load = vi.fn(async () => undefined);
  const mountSignIn = vi.fn();

  beforeEach(() => {
    load.mockClear();
    mountSignIn.mockClear();
    const clerkWindow = window as ClerkWindow;
    clerkWindow.Clerk = {
      load,
      mountSignIn,
      user: null,
      session: null
    } as never;
    clerkWindow.__internal_ClerkUICtor = {};
  });

  it('forces a signed-out user to return to the Lists zone after sign-in', async () => {
    await loadClerkSession('pk_test_example', document.createElement('div'));

    expect(mountSignIn).toHaveBeenCalledWith(expect.any(HTMLDivElement), {
      forceRedirectUrl: '/lists'
    });
  });
});
