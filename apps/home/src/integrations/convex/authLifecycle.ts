type ConvexTokenFetcher = (options: { forceRefreshToken: boolean }) => Promise<string | null>;

type ConvexAuthClient = {
  setAuth: (fetchToken: ConvexTokenFetcher) => void;
};

type ClerkGetToken = (options?: { skipCache?: boolean; template?: string }) => Promise<string | null>;

type ClerkAuthState = {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  getToken: ClerkGetToken;
};

export function createConvexAuthLifecycle(client: ConvexAuthClient) {
  return {
    update(state: ClerkAuthState) {
      if (!state.isLoaded) return;

      if (!state.isSignedIn) {
        client.setAuth(async () => null);
        return;
      }

      client.setAuth(({ forceRefreshToken }) => state.getToken({ template: 'convex', skipCache: forceRefreshToken }));
    },
    dispose() {
      client.setAuth(async () => null);
    }
  };
}
