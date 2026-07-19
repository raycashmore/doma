export type HomeRuntime =
  | { mode: 'demo' }
  | { mode: 'misconfigured'; message: string }
  | { mode: 'authenticated'; clerkPublishableKey: string; convexUrl: string };

export function resolveHomeRuntime({
  clerkPublishableKey,
  convexUrl,
  isDev
}: {
  clerkPublishableKey: string | undefined;
  convexUrl: string | undefined;
  isDev: boolean;
}): HomeRuntime {
  if (!clerkPublishableKey) {
    return isDev
      ? { mode: 'demo' }
      : {
          mode: 'misconfigured',
          message: 'VITE_CLERK_PUBLISHABLE_KEY is required outside local development.'
        };
  }
  if (!convexUrl) {
    return {
      mode: 'misconfigured',
      message: 'VITE_CONVEX_URL is required when Home authentication is enabled.'
    };
  }

  return { mode: 'authenticated', clerkPublishableKey, convexUrl };
}

// Turbo cannot statically recognize Vite's built-in environment fields.
// eslint-disable-next-line turbo/no-undeclared-env-vars
export const HOME_IS_DEV = import.meta.env.DEV;

export const HOME_RUNTIME = resolveHomeRuntime({
  clerkPublishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  isDev: HOME_IS_DEV
});
