import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertCanEditList,
  buildCanonicalListPath,
  createListHandler,
  createUniqueListPublicId,
  deleteListHandler,
  renameListFields,
  renameListHandler
} from './mutations';

type TestListRow = {
  _id: string;
  publicId: string;
  name: string;
  slug: string;
  visibility: 'personal' | 'shared';
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
};

const sharedList: TestListRow = {
  _id: 'list_row_shared',
  publicId: 'list_shared',
  name: 'Shared shopping',
  slug: 'shared-shopping',
  visibility: 'shared',
  createdByUserId: 'user_a',
  createdAt: 1,
  updatedAt: 1
};

const personalList: TestListRow = {
  _id: 'list_row_personal',
  publicId: 'list_personal',
  name: 'Weekend reset',
  slug: 'weekend-reset',
  visibility: 'personal',
  createdByUserId: 'user_a',
  createdAt: 1,
  updatedAt: 1
};

function createMutationCtx(identity: { subject: string } | null, rows: readonly TestListRow[] = []) {
  const insertedRows: Array<Record<string, unknown>> = [];
  const patchedRows: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const deletedIds: string[] = [];
  const publicIdLookups: string[] = [];

  const ctx = {
    auth: {
      getUserIdentity: async () => identity
    },
    db: {
      insert: async (table: string, row: Record<string, unknown>) => {
        expect(table).toBe('lists');
        insertedRows.push(row);
        return 'new_row_id';
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        patchedRows.push({ id, patch });
      },
      delete: async (id: string) => {
        deletedIds.push(id);
      },
      query: (table: string) => {
        expect(table).toBe('lists');
        return {
          withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
            expect(index).toBe('by_public_id');
            let requestedPublicId = '';
            apply({
              eq: (field, value) => {
                expect(field).toBe('publicId');
                requestedPublicId = value;
                publicIdLookups.push(value);
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

  return { ctx, insertedRows, patchedRows, deletedIds, publicIdLookups };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assertCanEditList', () => {
  it('allows editing a shared list owned by the current user', () => {
    expect(() => assertCanEditList({ visibility: 'shared', createdByUserId: 'user_a' }, 'user_a')).not.toThrow();
  });

  it('allows editing a shared list owned by another user', () => {
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

  it('rejects blank names after trimming', () => {
    expect(() => renameListFields('   ')).toThrow('List name is required');
  });
});

describe('buildCanonicalListPath', () => {
  it('returns the canonical path for a list link', () => {
    expect(buildCanonicalListPath({ publicId: 'list_abc', slug: 'shared-shopping' })).toBe(
      '/lists/l/list_abc/shared-shopping'
    );
  });
});

describe('createList', () => {
  it('rejects unauthenticated callers', async () => {
    const { ctx } = createMutationCtx(null);

    await expect(createListHandler(ctx as never, { name: 'Shared shopping', visibility: 'shared' })).rejects.toThrow(
      'Not authenticated'
    );
  });

  it('inserts the list row and returns its canonical path', async () => {
    const { ctx, insertedRows, publicIdLookups } = createMutationCtx({ subject: 'user_123' });
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    await expect(
      createListHandler(ctx as never, {
        name: '  Shared shopping  ',
        visibility: 'shared'
      })
    ).resolves.toMatchObject({
      _id: 'new_row_id',
      name: 'Shared shopping',
      slug: 'shared-shopping',
      visibility: 'shared',
      createdByUserId: 'user_123',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      canonicalPath: expect.stringMatching(/^\/lists\/l\/list_[a-z0-9]+\/shared-shopping$/)
    });

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      name: 'Shared shopping',
      slug: 'shared-shopping',
      visibility: 'shared',
      createdByUserId: 'user_123',
      createdAt: 1700000000000,
      updatedAt: 1700000000000
    });
    const insertedRow = insertedRows[0];
    expect(insertedRow).toBeDefined();
    expect(insertedRow!.publicId).toEqual(expect.stringMatching(/^list_[a-z0-9]+$/));
    expect(publicIdLookups).toHaveLength(1);
  });
});

describe('createUniqueListPublicId', () => {
  it('retries when a generated public id is already taken', async () => {
    const collidingRow: TestListRow = { ...sharedList, publicId: 'list_taken-id' };
    const { ctx, publicIdLookups } = createMutationCtx({ subject: 'user_123' }, [collidingRow]);
    const createId = vi.fn().mockReturnValueOnce('taken-id').mockReturnValueOnce('fresh-id');

    await expect(createUniqueListPublicId(ctx as never, createId)).resolves.toBe('list_fresh-id');
    expect(publicIdLookups).toEqual(['list_taken-id', 'list_fresh-id']);
  });
});

describe('renameList', () => {
  it('rejects blank names after trimming', async () => {
    const { ctx } = createMutationCtx({ subject: 'user_a' }, [personalList]);

    await expect(renameListHandler(ctx as never, { publicId: personalList.publicId, name: '   ' })).rejects.toThrow(
      'List name is required'
    );
  });

  it('rejects editing a personal list owned by another user', async () => {
    const { ctx, patchedRows } = createMutationCtx({ subject: 'user_b' }, [personalList]);

    await expect(
      renameListHandler(ctx as never, { publicId: personalList.publicId, name: 'Weekend reset 2' })
    ).rejects.toThrow('List unavailable');
    expect(patchedRows).toEqual([]);
  });

  it('allows editing a shared list owned by another user', async () => {
    const { ctx, patchedRows } = createMutationCtx({ subject: 'user_b' }, [sharedList]);
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    await expect(
      renameListHandler(ctx as never, { publicId: sharedList.publicId, name: 'Shared shopping 2' })
    ).resolves.toMatchObject({
      _id: sharedList._id,
      publicId: sharedList.publicId,
      name: 'Shared shopping 2',
      slug: 'shared-shopping-2',
      canonicalPath: '/lists/l/list_shared/shared-shopping-2',
      updatedAt: 1700000000000
    });

    expect(patchedRows).toEqual([
      {
        id: sharedList._id,
        patch: {
          name: 'Shared shopping 2',
          slug: 'shared-shopping-2',
          updatedAt: 1700000000000
        }
      }
    ]);
  });

  it('allows editing a shared list owned by the current user', async () => {
    const { ctx, patchedRows } = createMutationCtx({ subject: 'user_a' }, [sharedList]);
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    await expect(
      renameListHandler(ctx as never, { publicId: sharedList.publicId, name: 'Shared shopping 2' })
    ).resolves.toMatchObject({
      _id: sharedList._id,
      publicId: sharedList.publicId,
      name: 'Shared shopping 2',
      slug: 'shared-shopping-2',
      canonicalPath: '/lists/l/list_shared/shared-shopping-2',
      updatedAt: 1700000000000
    });

    expect(patchedRows).toEqual([
      {
        id: sharedList._id,
        patch: {
          name: 'Shared shopping 2',
          slug: 'shared-shopping-2',
          updatedAt: 1700000000000
        }
      }
    ]);
  });
});

describe('deleteList', () => {
  it('rejects editing a personal list owned by another user', async () => {
    const { ctx, deletedIds } = createMutationCtx({ subject: 'user_b' }, [personalList]);

    await expect(deleteListHandler(ctx as never, { publicId: personalList.publicId })).rejects.toThrow(
      'List unavailable'
    );
    expect(deletedIds).toEqual([]);
  });

  it('allows deleting a shared list owned by another user', async () => {
    const { ctx, deletedIds } = createMutationCtx({ subject: 'user_b' }, [sharedList]);

    await expect(deleteListHandler(ctx as never, { publicId: sharedList.publicId })).resolves.toEqual({
      publicId: sharedList.publicId
    });
    expect(deletedIds).toEqual([sharedList._id]);
  });

  it('allows deleting a shared list owned by the current user', async () => {
    const { ctx, deletedIds } = createMutationCtx({ subject: 'user_a' }, [sharedList]);

    await expect(deleteListHandler(ctx as never, { publicId: sharedList.publicId })).resolves.toEqual({
      publicId: sharedList.publicId
    });
    expect(deletedIds).toEqual([sharedList._id]);
  });
});
