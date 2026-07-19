import { useAuth } from '@clerk/vue';
import { useConvexClient } from 'convex-vue';
import { onScopeDispose, type Ref, watch } from 'vue';

import { createConvexAuthLifecycle } from './authLifecycle';

type AuthBridgeState = {
  isLoaded: Ref<boolean>;
  isSignedIn: Ref<boolean | undefined>;
  getToken: Ref<(options?: { skipCache?: boolean; template?: string }) => Promise<string | null>>;
};

type AuthBridgeClient = {
  setAuth: (fetchToken: (options: { forceRefreshToken: boolean }) => Promise<string | null>) => void;
};

export function useConvexAuthBridge(auth: AuthBridgeState = useAuth(), client: AuthBridgeClient = useConvexClient()) {
  const lifecycle = createConvexAuthLifecycle(client);
  const stop = watch(
    [auth.isLoaded, auth.isSignedIn, auth.getToken],
    ([isLoaded, isSignedIn, getToken]) => {
      lifecycle.update({ isLoaded, isSignedIn, getToken });
    },
    { immediate: true }
  );

  onScopeDispose(() => {
    stop();
    lifecycle.dispose();
  });
}
