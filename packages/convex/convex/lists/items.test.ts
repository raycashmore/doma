import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Id } from '../_generated/dataModel';
import {
  clearCompletedListItemsHandler,
  completeListItemHandler,
  createListItemHandler,
  deleteListItemHandler,
  readVisibleListItemsByPublicId,
  renameListItemHandler,
  reorderListItemHandler,
  uncompleteListItemHandler
} from './items';

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

const activeItemA: TestListItemRow = {
  _id: 'item_a',
  listId: sharedList._id,
  title: 'Bananas',
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1
};

const activeItemB: TestListItemRow = {
  _id: 'item_b',
  listId: sharedList._id,
  title: 'Apples',
  sortOrder: 1,
  createdAt: 2,
  updatedAt: 2
};

const completedItem: TestListItemRow = {
  _id: 'item_c',
  listId: sharedList._id,
  title: 'Coffee beans',
  sortOrder: 2,
  completedAt: 150,
  createdAt: 3,
  updatedAt: 150
};

const listItemId = (value: string) => value as Id<'listItems'>;

function createItemsCtx(
  identity: { subject: string } | null,
  lists: readonly TestListRow[] = [],
  items: readonly TestListItemRow[] = []
) {
  const state = {
    lists: [...lists],
    items: [...items]
  };

  const insertedRows: Array<Record<string, unknown>> = [];
  const patchedRows: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const deletedIds: string[] = [];

  const ctx = {
    auth: {
      getUserIdentity: async () => identity
    },
    db: {
      get: async (id: string) => {
        const listMatch = state.lists.find((row) => row._id === id);
        if (listMatch) return listMatch;

        return state.items.find((row) => row._id === id) ?? null;
      },
      insert: async (table: string, row: Record<string, unknown>) => {
        if (table === 'listItems') {
          insertedRows.push(row);
          return 'new_item_id';
        }

        throw new Error(`Unexpected insert table ${table}`);
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        patchedRows.push({ id, patch });
        state.items = state.items.map((item) => (item._id === id ? { ...item, ...patch } : item));
      },
      delete: async (id: string) => {
        deletedIds.push(id);
        state.items = state.items.filter((item) => item._id !== id);
      },
      query: (table: string) => {
        if (table === 'lists') {
          return {
            collect: async () => [...state.lists],
            withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
              expect(index).toBe('by_public_id');
              let publicId = '';
              apply({
                eq: (field, value) => {
                  expect(field).toBe('publicId');
                  publicId = value;
                  return value;
                }
              });
              return {
                unique: async () => state.lists.find((row) => row.publicId === publicId) ?? null
              };
            }
          };
        }

        if (table === 'listItems') {
          return {
            collect: async () => [...state.items],
            withIndex: (
              index: string,
              apply: (q: { eq: (field: string, value: string) => unknown }) => unknown
            ) => {
              let filterField = '';
              let filterValue = '';
              apply({
                eq: (field, value) => {
                  filterField = field;
                  filterValue = value;
                  return value;
                }
              });

              if (index === 'by_list_id') {
                expect(filterField).toBe('listId');
                return {
                  collect: async () => state.items.filter((row) => row.listId === filterValue)
                };
              }

              throw new Error(`Unexpected listItems index ${index}`);
            }
          };
        }

        throw new Error(`Unexpected query table ${table}`);
      }
    }
  };

  return { ctx, insertedRows, patchedRows, deletedIds, state };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readVisibleListItemsByPublicId', () => {
  it('returns active items by active order and completed items by completion time', async () => {
    const { ctx } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [{ ...completedItem, completedAt: 175 }, activeItemB, activeItemA]
    );

    await expect(
      readVisibleListItemsByPublicId(ctx as never, {
        publicId: sharedList.publicId
      })
    ).resolves.toMatchObject({
      list: { publicId: sharedList.publicId, name: sharedList.name },
      activeItems: [activeItemA, activeItemB],
      completedItems: [{ ...completedItem, completedAt: 175 }]
    });
  });

  it('returns null when the list is not visible to the caller', async () => {
    const { ctx } = createItemsCtx({ subject: 'user_b' }, [personalList], []);

    await expect(
      readVisibleListItemsByPublicId(ctx as never, {
        publicId: personalList.publicId
      })
    ).resolves.toBeNull();
  });
});

describe('createListItem', () => {
  it('creates a new active item at the end of the active list', async () => {
    const { ctx, insertedRows } = createItemsCtx({ subject: 'user_b' }, [sharedList], [activeItemA, completedItem]);
    vi.spyOn(Date, 'now').mockReturnValue(200);

    await expect(
      createListItemHandler(ctx as never, {
        listPublicId: sharedList.publicId,
        title: '  Milk  '
      })
    ).resolves.toMatchObject({
      _id: 'new_item_id',
      listId: sharedList._id,
      title: 'Milk',
      sortOrder: 1,
      createdAt: 200,
      updatedAt: 200
    });

    expect(insertedRows).toEqual([
      {
        listId: sharedList._id,
        title: 'Milk',
        sortOrder: 1,
        createdAt: 200,
        updatedAt: 200
      }
    ]);
  });

  it('rejects a blank title after trimming', async () => {
    const { ctx } = createItemsCtx({ subject: 'user_b' }, [sharedList], []);

    await expect(
      createListItemHandler(ctx as never, {
        listPublicId: sharedList.publicId,
        title: '   '
      })
    ).rejects.toThrow('List item title is required');
  });
});

describe('renameListItem', () => {
  it('renames an item in a visible shared list', async () => {
    const { ctx, patchedRows } = createItemsCtx({ subject: 'user_b' }, [sharedList], [activeItemA]);
    vi.spyOn(Date, 'now').mockReturnValue(220);

    await expect(
      renameListItemHandler(ctx as never, {
        itemId: listItemId(activeItemA._id),
        title: '  Green bananas  '
      })
    ).resolves.toMatchObject({
      _id: activeItemA._id,
      title: 'Green bananas',
      updatedAt: 220
    });

    expect(patchedRows).toEqual([
      {
        id: activeItemA._id,
        patch: {
          title: 'Green bananas',
          updatedAt: 220
        }
      }
    ]);
  });
});

describe('deleteListItem', () => {
  it('deletes an item from a visible shared list', async () => {
    const { ctx, deletedIds } = createItemsCtx({ subject: 'user_b' }, [sharedList], [activeItemA]);

    await expect(deleteListItemHandler(ctx as never, { itemId: listItemId(activeItemA._id) })).resolves.toEqual({
      itemId: listItemId(activeItemA._id)
    });

    expect(deletedIds).toEqual([activeItemA._id]);
  });
});

describe('completeListItem', () => {
  it('marks an active item complete and removes it from active ordering', async () => {
    const { ctx, patchedRows, state } = createItemsCtx({ subject: 'user_b' }, [sharedList], [activeItemA]);
    vi.spyOn(Date, 'now').mockReturnValue(250);

    await expect(completeListItemHandler(ctx as never, { itemId: listItemId(activeItemA._id) })).resolves.toMatchObject({
      _id: activeItemA._id,
      completedAt: 250
    });

    expect(patchedRows).toEqual([
      {
        id: activeItemA._id,
        patch: {
          completedAt: 250,
          updatedAt: 250
        }
      }
    ]);
    expect(state.items[0]?.completedAt).toBe(250);
  });
});

describe('uncompleteListItem', () => {
  it('returns a completed item to the end of the active list', async () => {
    const { ctx, patchedRows } = createItemsCtx({ subject: 'user_b' }, [sharedList], [activeItemA, completedItem]);
    vi.spyOn(Date, 'now').mockReturnValue(300);

    await expect(uncompleteListItemHandler(ctx as never, { itemId: listItemId(completedItem._id) })).resolves.toMatchObject({
      _id: completedItem._id,
      completedAt: undefined,
      sortOrder: 1,
      updatedAt: 300
    });

    expect(patchedRows).toEqual([
      {
        id: completedItem._id,
        patch: {
          completedAt: undefined,
          sortOrder: 1,
          updatedAt: 300
        }
      }
    ]);
  });
});

describe('reorderListItem', () => {
  it('moves an active item to the requested active index and resequences neighbors', async () => {
    const { ctx, state } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA, activeItemB, { ...activeItemB, _id: 'item_d', title: 'Bread', sortOrder: 2, createdAt: 4, updatedAt: 4 }]
    );
    vi.spyOn(Date, 'now').mockReturnValue(400);

    await reorderListItemHandler(ctx as never, { itemId: listItemId('item_d'), targetIndex: 0 });

    expect(
      state.items
        .filter((item) => item.completedAt === undefined)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => [item._id, item.sortOrder])
    ).toEqual([
      ['item_d', 0],
      ['item_a', 1],
      ['item_b', 2]
    ]);
  });
});

describe('clearCompletedListItems', () => {
  it('deletes all completed items from a visible shared list', async () => {
    const { ctx, deletedIds } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA, completedItem, { ...completedItem, _id: 'item_done_2', completedAt: 200 }]
    );

    await expect(
      clearCompletedListItemsHandler(ctx as never, {
        listPublicId: sharedList.publicId
      })
    ).resolves.toEqual({
      removedItemIds: ['item_done_2', 'item_c']
    });

    expect(deletedIds).toEqual(['item_done_2', 'item_c']);
  });
});
