import { describe, expect, it } from 'vitest';

import { resolveHomeRuntime } from './runtime';

describe('resolveHomeRuntime', () => {
  it('uses local demo mode when Clerk is intentionally absent', () => {
    expect(resolveHomeRuntime({ clerkPublishableKey: '', convexUrl: '', isDev: true })).toEqual({ mode: 'demo' });
  });

  it('fails closed when Clerk is absent outside local development', () => {
    expect(resolveHomeRuntime({ clerkPublishableKey: '', convexUrl: '', isDev: false })).toEqual({
      mode: 'misconfigured',
      message: 'VITE_CLERK_PUBLISHABLE_KEY is required outside local development.'
    });
  });

  it('fails closed when Clerk is configured without Convex', () => {
    expect(resolveHomeRuntime({ clerkPublishableKey: 'pk_test_example', convexUrl: '', isDev: false })).toEqual({
      mode: 'misconfigured',
      message: 'VITE_CONVEX_URL is required when Home authentication is enabled.'
    });
  });

  it('enables authenticated mode only when both services are configured', () => {
    expect(
      resolveHomeRuntime({
        clerkPublishableKey: 'pk_test_example',
        convexUrl: 'https://example.convex.cloud',
        isDev: false
      })
    ).toEqual({
      mode: 'authenticated',
      clerkPublishableKey: 'pk_test_example',
      convexUrl: 'https://example.convex.cloud'
    });
  });
});
