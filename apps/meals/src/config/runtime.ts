type MealsRuntimeInput = {
  isDev: boolean;
  clerkKey?: string;
  convexUrl?: string;
};

export type MealsRuntime = { mode: 'fixture' } | { mode: 'authenticated' } | { mode: 'misconfigured'; message: string };

export function resolveMealsRuntime({ isDev, clerkKey, convexUrl }: MealsRuntimeInput): MealsRuntime {
  if (!convexUrl) return { mode: 'misconfigured', message: 'VITE_CONVEX_URL is required.' };
  if (!clerkKey) {
    return isDev
      ? { mode: 'fixture' }
      : { mode: 'misconfigured', message: 'VITE_CLERK_PUBLISHABLE_KEY is required in production.' };
  }
  return { mode: 'authenticated' };
}

export const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
export const MEALS_RUNTIME = resolveMealsRuntime({
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  isDev: import.meta.env.DEV,
  clerkKey: CLERK_KEY,
  convexUrl: CONVEX_URL
});
export const FIXTURE_MODE = MEALS_RUNTIME.mode === 'fixture';
