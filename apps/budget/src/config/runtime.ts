// Local dev without a Clerk key shows generic fixture data: finance queries reject signed-out callers.
export function isFixtureMode({ isDev, clerkKey }: { isDev: boolean; clerkKey: string | undefined }) {
  return isDev && !clerkKey;
}

export const FIXTURE_MODE = isFixtureMode({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  isDev: import.meta.env.DEV,
  clerkKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
});
