import { describe, expect, it } from 'vitest';

import { assertCanEditList, buildCanonicalListPath, renameListFields } from './mutations';

describe('assertCanEditList', () => {
  it('allows editing a shared list', () => {
    expect(() => assertCanEditList({ visibility: 'shared', createdByUserId: 'user_a' }, 'user_b')).not.toThrow();
  });

  it('rejects editing a personal list owned by another user', () => {
    expect(() => assertCanEditList({ visibility: 'personal', createdByUserId: 'user_a' }, 'user_b')).toThrow(
      'List unavailable'
    );
  });
});

describe('renameListFields', () => {
  it('updates both name and slug from the new title', () => {
    expect(renameListFields('Weekend reset 2')).toEqual({
      name: 'Weekend reset 2',
      slug: 'weekend-reset-2'
    });
  });
});

describe('buildCanonicalListPath', () => {
  it('returns the canonical path for a list link', () => {
    expect(buildCanonicalListPath({ publicId: 'list_abc', slug: 'shared-shopping' })).toBe(
      '/lists/l/list_abc/shared-shopping'
    );
  });
});
