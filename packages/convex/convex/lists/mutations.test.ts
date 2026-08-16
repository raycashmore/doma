import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertCanEditList,
  buildCanonicalListPath,
  createListHandler,
  createUniqueListPublicId,
  deleteListHandler,
  renameListAndInvalidateHandler,
  renameListFields,
  renameListHandler,
  sendItemsToSharedShoppingListHandler
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

type TestListItemRow = {
  _id: string;
  listId: string;
  title: string;
  sortOrder: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
};

type TestListPropertyRow = {
  _id: string;
  listId: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  sortOrder: number;
  options?: Array<{ id: string; label: string }>;
  createdAt: number;
  updatedAt: number;
};

type TestListItemPropertyValueRow = {
  _id: string;
  listId: string;
  listItemId: string;
  listPropertyId: string;
  textValue?: string;
  numberValue?: number;
  dateValue?: number;
  selectOptionId?: string;
  checkboxValue?: boolean;
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

function createMutationCtx(
  identity: { subject: string } | null,
  rows: readonly TestListRow[] = [],
  items: readonly TestListItemRow[] = [],
  properties: readonly TestListPropertyRow[] = [],
  values: readonly TestListItemPropertyValueRow[] = []
) {
  const state = {
    rows: [...rows],
    items: [...items],
    properties: [...properties],
    values: [...values]
  };
  const insertedRows: Array<Record<string, unknown>> = [];
  const patchedRows: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const deletedIds: string[] = [];
  const publicIdLookups: string[] = [];
  const scheduled: unknown[][] = [];

  const ctx = {
    auth: {
      getUserIdentity: async () => identity
    },
    scheduler: {
      runAfter: async (...args: unknown[]) => {
        scheduled.push(args);
        return 'scheduled';
      }
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
        state.rows = state.rows.filter((row) => row._id !== id);
        state.items = state.items.filter((row) => row._id !== id);
        state.properties = state.properties.filter((row) => row._id !== id);
        state.values = state.values.filter((row) => row._id !== id);
      },
      query: (table: string) => {
        if (table === 'lists') {
          return {
            withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
              if (index === 'by_visibility') {
                let requestedVisibility = '';
                apply({
                  eq: (field, value) => {
                    expect(field).toBe('visibility');
                    requestedVisibility = value;
                    return value;
                  }
                });
                return {
                  collect: async () => state.rows.filter((row) => row.visibility === requestedVisibility)
                };
              }

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
                unique: async () => state.rows.find((row) => row.publicId === requestedPublicId) ?? null
              };
            }
          };
        }

        if (table === 'listItems') {
          return {
            withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
              expect(index).toBe('by_list_id');
              let listId = '';
              apply({
                eq: (field, value) => {
                  expect(field).toBe('listId');
                  listId = value;
                  return value;
                }
              });
              return {
                collect: async () => state.items.filter((row) => row.listId === listId)
              };
            }
          };
        }

        if (table === 'listProperties') {
          return {
            withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
              expect(index).toBe('by_list_id');
              let listId = '';
              apply({
                eq: (field, value) => {
                  expect(field).toBe('listId');
                  listId = value;
                  return value;
                }
              });
              return {
                collect: async () => state.properties.filter((row) => row.listId === listId)
              };
            }
          };
        }

        if (table === 'listItemPropertyValues') {
          return {
            withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
              expect(index).toBe('by_list_id');
              let listId = '';
              apply({
                eq: (field, value) => {
                  expect(field).toBe('listId');
                  listId = value;
                  return value;
                }
              });
              return {
                collect: async () => state.values.filter((row) => row.listId === listId)
              };
            }
          };
        }

        throw new Error(`Unexpected query table ${table}`);
      }
    }
  };

  return { ctx, insertedRows, patchedRows, deletedIds, publicIdLookups, scheduled, state };
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

describe('renameListAndInvalidate', () => {
  it('queues a widget refresh after changing a list title', async () => {
    const { ctx, scheduled } = createMutationCtx({ subject: 'user_a' }, [personalList]);

    await renameListAndInvalidateHandler(ctx as never, {
      publicId: personalList.publicId,
      name: 'Weekend reset plan'
    });

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.[0]).toBe(0);
    expect(scheduled[0]?.[2]).toEqual({});
  });
});

describe('sendItemsToSharedShoppingList', () => {
  const shoppingList = { ...sharedList, name: 'Shopping list' };
  const titles = ['2 tins beans', '1 lemon', '2 tins beans'];

  it('rejects unauthenticated callers without writing', async () => {
    const { ctx } = createMutationCtx(null, [shoppingList]);
    const createItems = vi.fn();

    await expect(sendItemsToSharedShoppingListHandler(ctx as never, { titles }, createItems)).rejects.toThrow(
      'Not authenticated'
    );
    expect(createItems).not.toHaveBeenCalled();
  });

  it.each([
    ['no matching list', []],
    ['multiple matching lists', [shoppingList, { ...shoppingList, _id: 'list_row_second', publicId: 'list_second' }]]
  ])('returns unavailable and does not write for %s', async (_label, rows) => {
    const { ctx } = createMutationCtx({ subject: 'user_123' }, rows);
    const createItems = vi.fn();

    await expect(sendItemsToSharedShoppingListHandler(ctx as never, { titles }, createItems)).resolves.toEqual({
      status: 'unavailable'
    });
    expect(createItems).not.toHaveBeenCalled();
  });

  it('writes the exact ordered titles to the single matching shared list', async () => {
    const { ctx } = createMutationCtx({ subject: 'user_123' }, [shoppingList, personalList]);
    const createItems = vi.fn().mockResolvedValue(titles.map((title) => ({ title })));

    await expect(sendItemsToSharedShoppingListHandler(ctx as never, { titles }, createItems)).resolves.toEqual({
      status: 'created',
      count: 3
    });
    expect(createItems).toHaveBeenCalledWith(ctx, { listPublicId: shoppingList.publicId, titles });
  });

  it.each([[''], ['  '], [' 2 tins beans'], ['2 tins beans ']])(
    'rejects a non-normalized title without writing: %j',
    async (title) => {
      const { ctx } = createMutationCtx({ subject: 'user_123' }, [shoppingList]);
      const createItems = vi.fn();

      await expect(
        sendItemsToSharedShoppingListHandler(ctx as never, { titles: ['1 lemon', title] }, createItems)
      ).rejects.toThrow('Shopping cart items must be non-empty and normalized');
      expect(createItems).not.toHaveBeenCalled();
    }
  );
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

  it('deletes the list subtree before deleting the list row', async () => {
    const { ctx, deletedIds, state } = createMutationCtx(
      { subject: 'user_a' },
      [sharedList],
      [
        {
          _id: 'item_a',
          listId: sharedList._id,
          title: 'Bananas',
          sortOrder: 0,
          createdAt: 1,
          updatedAt: 1
        }
      ],
      [
        {
          _id: 'prop_notes',
          listId: sharedList._id,
          name: 'Notes',
          type: 'text',
          sortOrder: 0,
          createdAt: 1,
          updatedAt: 1
        }
      ],
      [
        {
          _id: 'value_notes_item_a',
          listId: sharedList._id,
          listItemId: 'item_a',
          listPropertyId: 'prop_notes',
          textValue: 'ripe ones',
          createdAt: 1,
          updatedAt: 1
        }
      ]
    );

    await expect(deleteListHandler(ctx as never, { publicId: sharedList.publicId })).resolves.toEqual({
      publicId: sharedList.publicId
    });

    expect(deletedIds).toEqual(['value_notes_item_a', 'item_a', 'prop_notes', sharedList._id]);
    expect(state.rows).toEqual([]);
    expect(state.items).toEqual([]);
    expect(state.properties).toEqual([]);
    expect(state.values).toEqual([]);
  });

  it('allows deleting a shared list owned by the current user', async () => {
    const { ctx, deletedIds } = createMutationCtx({ subject: 'user_a' }, [sharedList]);

    await expect(deleteListHandler(ctx as never, { publicId: sharedList.publicId })).resolves.toEqual({
      publicId: sharedList.publicId
    });
    expect(deletedIds).toEqual([sharedList._id]);
  });
});
