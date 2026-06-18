import { afterEach, describe, expect, it, vi } from 'vitest';

import { createListPropertyHandler, removeListPropertyHandler, reorderListPropertyHandler } from './items';

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

const priorityProperty: TestListPropertyRow = {
  _id: 'prop_priority',
  listId: sharedList._id,
  name: 'Priority',
  type: 'select',
  sortOrder: 0,
  options: [
    { id: 'opt_low', label: 'Low' },
    { id: 'opt_high', label: 'High' }
  ],
  createdAt: 1,
  updatedAt: 1
};

const dueDateProperty: TestListPropertyRow = {
  _id: 'prop_due_date',
  listId: sharedList._id,
  name: 'Due date',
  type: 'date',
  sortOrder: 1,
  createdAt: 1,
  updatedAt: 1
};

const listPropertyId = (value: string) => value as never;

function createPropertiesCtx(
  identity: { subject: string } | null,
  lists: readonly TestListRow[] = [],
  properties: readonly TestListPropertyRow[] = [],
  values: readonly TestListItemPropertyValueRow[] = []
) {
  const state = {
    lists: [...lists],
    properties: [...properties],
    values: [...values]
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

        const propertyMatch = state.properties.find((row) => row._id === id);
        if (propertyMatch) return propertyMatch;

        return state.values.find((row) => row._id === id) ?? null;
      },
      insert: async (table: string, row: Record<string, unknown>) => {
        if (table === 'listProperties') {
          insertedRows.push(row);
          state.properties.push({ _id: 'new_property_id', ...(row as TestListPropertyRow) });
          return 'new_property_id';
        }

        throw new Error(`Unexpected insert table ${table}`);
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        patchedRows.push({ id, patch });
        state.properties = state.properties.map((property) =>
          property._id === id ? { ...property, ...patch } : property
        );
      },
      delete: async (id: string) => {
        deletedIds.push(id);
        state.properties = state.properties.filter((property) => property._id !== id);
        state.values = state.values.filter((value) => value._id !== id);
      },
      query: (table: string) => {
        if (table === 'lists') {
          return {
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
              expect(index).toBe('by_property_id');
              let propertyId = '';
              apply({
                eq: (field, value) => {
                  expect(field).toBe('listPropertyId');
                  propertyId = value;
                  return value;
                }
              });
              return {
                collect: async () => state.values.filter((row) => row.listPropertyId === propertyId)
              };
            }
          };
        }

        throw new Error(`Unexpected query table ${table}`);
      }
    }
  };

  return { ctx, deletedIds, insertedRows, patchedRows, state };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createListProperty', () => {
  it('creates a property at the end of the list property order', async () => {
    const { ctx } = createPropertiesCtx({ subject: 'user_b' }, [sharedList], [priorityProperty, dueDateProperty]);
    vi.spyOn(Date, 'now').mockReturnValue(200);

    await expect(
      createListPropertyHandler(ctx as never, {
        listPublicId: sharedList.publicId,
        name: 'Store section',
        type: 'text'
      })
    ).resolves.toMatchObject({
      _id: 'new_property_id',
      listId: sharedList._id,
      name: 'Store section',
      type: 'text',
      sortOrder: 2
    });
  });
});

describe('reorderListProperty', () => {
  it('reorders properties within a list', async () => {
    const { ctx } = createPropertiesCtx({ subject: 'user_b' }, [sharedList], [priorityProperty, dueDateProperty]);

    await expect(
      reorderListPropertyHandler(ctx as never, {
        propertyId: listPropertyId('prop_due_date'),
        targetIndex: 0
      })
    ).resolves.toMatchObject([
      { _id: 'prop_due_date', sortOrder: 0 },
      { _id: 'prop_priority', sortOrder: 1 }
    ]);
  });
});

describe('removeListProperty', () => {
  it('removes a property and deletes its item values', async () => {
    const { ctx, deletedIds, state } = createPropertiesCtx(
      { subject: 'user_b' },
      [sharedList],
      [priorityProperty, dueDateProperty],
      [
        {
          _id: 'value_priority_item_a',
          listItemId: 'item_a',
          listPropertyId: priorityProperty._id,
          selectOptionId: 'opt_high',
          createdAt: 1,
          updatedAt: 1
        },
        {
          _id: 'value_priority_item_b',
          listItemId: 'item_b',
          listPropertyId: priorityProperty._id,
          selectOptionId: 'opt_low',
          createdAt: 1,
          updatedAt: 1
        }
      ]
    );

    await expect(
      removeListPropertyHandler(ctx as never, { propertyId: listPropertyId('prop_priority') })
    ).resolves.toEqual({
      propertyId: listPropertyId('prop_priority'),
      removedValueIds: ['value_priority_item_a', 'value_priority_item_b']
    });

    expect(deletedIds).toEqual(['value_priority_item_a', 'value_priority_item_b', 'prop_priority']);
    expect(state.properties.map((property) => property._id)).toEqual(['prop_due_date']);
    expect(state.values).toEqual([]);
  });
});
