import { describe, expect, it } from 'vitest';

import { filterVisibleLists, pickVisibleListByPublicId } from './queries';

const sharedList = {
  publicId: 'list_shared',
  name: 'Shared shopping',
  slug: 'shared-shopping',
  visibility: 'shared',
  createdByUserId: 'user_a',
  createdAt: 1,
  updatedAt: 1
} as const;

const personalList = {
  publicId: 'list_personal',
  name: 'Weekend reset',
  slug: 'weekend-reset',
  visibility: 'personal',
  createdByUserId: 'user_a',
  createdAt: 1,
  updatedAt: 1
} as const;

describe('filterVisibleLists', () => {
  it('returns shared lists plus the caller personal lists', () => {
    expect(filterVisibleLists([sharedList, personalList], 'user_a')).toEqual([sharedList, personalList]);
    expect(filterVisibleLists([sharedList, personalList], 'user_b')).toEqual([sharedList]);
  });
});

describe('pickVisibleListByPublicId', () => {
  it('returns a shared or owned list when it is visible to the caller', () => {
    expect(pickVisibleListByPublicId([sharedList, personalList], 'list_shared', 'user_b')).toEqual(
      sharedList
    );
    expect(
      pickVisibleListByPublicId([sharedList, personalList], 'list_personal', 'user_a')
    ).toEqual(personalList);
  });

  it('returns null when a personal list is not visible to the caller', () => {
    expect(pickVisibleListByPublicId([sharedList, personalList], 'list_personal', 'user_b')).toBeNull();
  });
});
