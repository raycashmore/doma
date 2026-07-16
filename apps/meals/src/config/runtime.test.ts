import { describe, expect, it } from 'vitest';

import { resolveMealsRuntime } from './runtime';

describe('Meals runtime configuration', () => {
  it('allows fixtures only in configured local development', () => {
    expect(resolveMealsRuntime({ isDev: true, convexUrl: 'https://example.convex.cloud' })).toEqual({
      mode: 'fixture'
    });
    expect(resolveMealsRuntime({ isDev: false, convexUrl: 'https://example.convex.cloud' })).toEqual({
      mode: 'misconfigured',
      message: 'VITE_CLERK_PUBLISHABLE_KEY is required in production.'
    });
  });

  it('requires Convex in every runtime and Clerk in production', () => {
    expect(resolveMealsRuntime({ isDev: true })).toEqual({
      mode: 'misconfigured',
      message: 'VITE_CONVEX_URL is required.'
    });
    expect(
      resolveMealsRuntime({
        isDev: false,
        clerkKey: 'pk_live_example',
        convexUrl: 'https://example.convex.cloud'
      })
    ).toEqual({ mode: 'authenticated' });
  });
});
