import { describe, expect, it } from 'vitest';

import { isFixtureMode } from './runtime';

describe('isFixtureMode', () => {
  it('uses fixture data only in local dev without a Clerk key', () => {
    expect(isFixtureMode({ isDev: true, clerkKey: undefined })).toBe(true);
    expect(isFixtureMode({ isDev: true, clerkKey: '' })).toBe(true);
  });

  it('reads Convex whenever a Clerk key is set or the build is production', () => {
    expect(isFixtureMode({ isDev: true, clerkKey: 'pk_test_example' })).toBe(false);
    expect(isFixtureMode({ isDev: false, clerkKey: undefined })).toBe(false);
  });
});
