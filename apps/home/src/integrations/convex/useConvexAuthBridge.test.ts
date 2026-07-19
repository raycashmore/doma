import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { useConvexAuthBridge } from './useConvexAuthBridge';

describe('useConvexAuthBridge', () => {
  it('tracks Clerk sign-in and sign-out reactively and cleans up its client', async () => {
    const auth = {
      isLoaded: ref(false),
      isSignedIn: ref<boolean | undefined>(undefined),
      getToken: ref(vi.fn(async () => 'session-token'))
    };
    const client = {
      setAuth: vi.fn()
    };
    const scope = effectScope();

    scope.run(() => useConvexAuthBridge(auth, client));
    auth.isLoaded.value = true;
    auth.isSignedIn.value = true;
    await nextTick();

    expect(client.setAuth).toHaveBeenCalledOnce();

    auth.isSignedIn.value = false;
    await nextTick();
    expect(client.setAuth).toHaveBeenCalledTimes(2);

    auth.getToken.value = vi.fn(async () => 'renewed-session-token');
    auth.isSignedIn.value = true;
    await nextTick();
    expect(client.setAuth).toHaveBeenCalledTimes(3);
    await expect(client.setAuth.mock.calls[2]?.[0]?.({ forceRefreshToken: false })).resolves.toBe(
      'renewed-session-token'
    );

    scope.stop();
    expect(client.setAuth).toHaveBeenCalledTimes(4);
  });
});
