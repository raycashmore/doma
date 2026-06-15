import { describe, expect, it } from 'vitest';

import { filterVisibleLists, pickVisibleListByPublicId, readVisibleListByPublicId, readVisibleLists } from './queries';

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

function createQueryCtx(
  identity: { subject: string } | null,
  rows: readonly (typeof sharedList | typeof personalList)[]
) {
  let requestedPublicId: string | null = null;

  return {
    auth: {
      getUserIdentity: async () => identity
    },
    db: {
      query: (table: string) => {
        expect(table).toBe('lists');
        return {
          collect: async () => [...rows],
          withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
            expect(index).toBe('by_public_id');
            apply({
              eq: (field, value) => {
                expect(field).toBe('publicId');
                requestedPublicId = value;
                return value;
              }
            });
            return {
              unique: async () => rows.find((row) => row.publicId === requestedPublicId) ?? null
            };
          }
        };
      }
    }
  };
}

describe('filterVisibleLists', () => {
  it('returns shared lists plus the caller personal lists', () => {
    expect(filterVisibleLists([sharedList, personalList], 'user_a')).toEqual([sharedList, personalList]);
    expect(filterVisibleLists([sharedList, personalList], 'user_b')).toEqual([sharedList]);
  });
});

describe('pickVisibleListByPublicId', () => {
  it('returns a shared or owned list when it is visible to the caller', () => {
    expect(pickVisibleListByPublicId([sharedList, personalList], 'list_shared', 'user_b')).toEqual(sharedList);
    expect(pickVisibleListByPublicId([sharedList, personalList], 'list_personal', 'user_a')).toEqual(personalList);
  });

  it('returns null when a personal list is not visible to the caller', () => {
    expect(pickVisibleListByPublicId([sharedList, personalList], 'list_personal', 'user_b')).toBeNull();
  });
});

describe('readVisibleLists', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(readVisibleLists(createQueryCtx(null, [sharedList, personalList]) as never)).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('returns only lists visible to the authenticated caller', async () => {
    await expect(
      readVisibleLists(createQueryCtx({ subject: 'user_b' }, [sharedList, personalList]) as never)
    ).resolves.toEqual([sharedList]);
  });
});

describe('readVisibleListByPublicId', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(
      readVisibleListByPublicId(createQueryCtx(null, [sharedList, personalList]) as never, {
        publicId: 'list_shared'
      })
    ).rejects.toThrow('Not authenticated');
  });

  it('returns null when the row is missing', async () => {
    await expect(
      readVisibleListByPublicId(createQueryCtx({ subject: 'user_a' }, []) as never, {
        publicId: 'list_missing'
      })
    ).resolves.toBeNull();
  });
});
