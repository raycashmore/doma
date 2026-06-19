import { afterEach, describe, expect, it, vi } from 'vitest';

import * as propertiesModule from './properties';
import {
  dueDateProperty,
  getFutureHandler,
  listPropertyId,
  notesProperty,
  priorityProperty,
  sharedList,
  type TestListItemPropertyValueRow,
  type TestListPropertyRow,
  type TestListRow
} from './testHelpers';

type FutureListPropertiesModule = typeof propertiesModule & {
  createListPropertyHandler: (...args: unknown[]) => Promise<unknown>;
  renameListPropertyHandler: (...args: unknown[]) => Promise<unknown>;
  removeListPropertyHandler: (...args: unknown[]) => Promise<unknown>;
  reorderListPropertyHandler: (...args: unknown[]) => Promise<unknown>;
  replaceListPropertyOptionsHandler: (...args: unknown[]) => Promise<unknown>;
};

const createListPropertyHandler = getFutureHandler<FutureListPropertiesModule['createListPropertyHandler']>(
  propertiesModule,
  'createListPropertyHandler'
);
const renameListPropertyHandler = getFutureHandler<FutureListPropertiesModule['renameListPropertyHandler']>(
  propertiesModule,
  'renameListPropertyHandler'
);
const removeListPropertyHandler = getFutureHandler<FutureListPropertiesModule['removeListPropertyHandler']>(
  propertiesModule,
  'removeListPropertyHandler'
);
const reorderListPropertyHandler = getFutureHandler<FutureListPropertiesModule['reorderListPropertyHandler']>(
  propertiesModule,
  'reorderListPropertyHandler'
);
const replaceListPropertyOptionsHandler = getFutureHandler<
  FutureListPropertiesModule['replaceListPropertyOptionsHandler']
>(propertiesModule, 'replaceListPropertyOptionsHandler');

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
          state.properties.push({ ...(row as TestListPropertyRow), _id: 'new_property_id' });
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
    const { ctx, insertedRows, state } = createPropertiesCtx(
      { subject: 'user_b' },
      [sharedList],
      [priorityProperty, dueDateProperty]
    );
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

    expect(insertedRows).toEqual([
      {
        listId: sharedList._id,
        name: 'Store section',
        type: 'text',
        sortOrder: 2,
        options: undefined,
        createdAt: 200,
        updatedAt: 200
      }
    ]);
    expect(state.properties.map((property) => [property._id, property.sortOrder])).toEqual([
      ['prop_priority', 0],
      ['prop_due_date', 1],
      ['new_property_id', 2]
    ]);
  });

  it('rejects a blank property name after trimming', async () => {
    const { ctx } = createPropertiesCtx({ subject: 'user_b' }, [sharedList], [priorityProperty]);

    await expect(
      createListPropertyHandler(ctx as never, {
        listPublicId: sharedList.publicId,
        name: '   ',
        type: 'text'
      })
    ).rejects.toThrow('List property name is required');
  });

  it('rejects a select property without options', async () => {
    const { ctx } = createPropertiesCtx({ subject: 'user_b' }, [sharedList], [priorityProperty]);

    await expect(
      createListPropertyHandler(ctx as never, {
        listPublicId: sharedList.publicId,
        name: 'Priority',
        type: 'select'
      })
    ).rejects.toThrow('List property options are required');
  });

  it('rejects select options with blank ids or labels', async () => {
    const { ctx } = createPropertiesCtx({ subject: 'user_b' }, [sharedList], [priorityProperty]);

    await expect(
      createListPropertyHandler(ctx as never, {
        listPublicId: sharedList.publicId,
        name: 'Priority',
        type: 'select',
        options: [{ id: '   ', label: 'High' }]
      })
    ).rejects.toThrow('List property option id is required');

    await expect(
      createListPropertyHandler(ctx as never, {
        listPublicId: sharedList.publicId,
        name: 'Priority',
        type: 'select',
        options: [{ id: 'opt_high', label: '   ' }]
      })
    ).rejects.toThrow('List property option label is required');
  });

  it('rejects duplicate select option ids', async () => {
    const { ctx } = createPropertiesCtx({ subject: 'user_b' }, [sharedList], [priorityProperty]);

    await expect(
      createListPropertyHandler(ctx as never, {
        listPublicId: sharedList.publicId,
        name: 'Priority',
        type: 'select',
        options: [
          { id: 'opt_high', label: 'High' },
          { id: 'opt_high', label: 'Still high' }
        ]
      })
    ).rejects.toThrow('List property option ids must be unique');
  });

  it('rejects options for non-select property types', async () => {
    const { ctx } = createPropertiesCtx({ subject: 'user_b' }, [sharedList], [priorityProperty]);

    await expect(
      createListPropertyHandler(ctx as never, {
        listPublicId: sharedList.publicId,
        name: 'Notes',
        type: 'text',
        options: [{ id: 'opt_unused', label: 'Unused' }]
      })
    ).rejects.toThrow('List property options are only supported for select properties');
  });
});

describe('reorderListProperty', () => {
  it('reorders properties within a list', async () => {
    const { ctx, patchedRows, state } = createPropertiesCtx(
      { subject: 'user_b' },
      [sharedList],
      [priorityProperty, dueDateProperty]
    );
    vi.spyOn(Date, 'now').mockReturnValue(250);

    await expect(
      reorderListPropertyHandler(ctx as never, {
        propertyId: listPropertyId('prop_due_date'),
        targetIndex: 0
      })
    ).resolves.toMatchObject([
      { _id: 'prop_due_date', sortOrder: 0 },
      { _id: 'prop_priority', sortOrder: 1 }
    ]);

    expect(patchedRows).toEqual([
      {
        id: 'prop_due_date',
        patch: {
          sortOrder: 0,
          updatedAt: 250
        }
      },
      {
        id: 'prop_priority',
        patch: {
          sortOrder: 1,
          updatedAt: 250
        }
      }
    ]);
    expect(state.properties.map((property) => [property._id, property.sortOrder])).toEqual([
      ['prop_priority', 1],
      ['prop_due_date', 0]
    ]);
  });
});

describe('renameListProperty', () => {
  it('renames a property after trimming whitespace', async () => {
    const { ctx, patchedRows, state } = createPropertiesCtx({ subject: 'user_b' }, [sharedList], [notesProperty]);
    vi.spyOn(Date, 'now').mockReturnValue(260);

    await expect(
      renameListPropertyHandler(ctx as never, {
        propertyId: listPropertyId('prop_notes'),
        name: '  Shopping notes  '
      })
    ).resolves.toMatchObject({
      _id: 'prop_notes',
      name: 'Shopping notes',
      updatedAt: 260
    });

    expect(patchedRows).toEqual([
      {
        id: 'prop_notes',
        patch: {
          name: 'Shopping notes',
          updatedAt: 260
        }
      }
    ]);
    expect(state.properties).toContainEqual(
      expect.objectContaining({
        _id: 'prop_notes',
        name: 'Shopping notes',
        updatedAt: 260
      })
    );
  });

  it('rejects a blank property name after trimming', async () => {
    const { ctx } = createPropertiesCtx({ subject: 'user_b' }, [sharedList], [notesProperty]);

    await expect(
      renameListPropertyHandler(ctx as never, {
        propertyId: listPropertyId('prop_notes'),
        name: '   '
      })
    ).rejects.toThrow('List property name is required');
  });
});

describe('removeListProperty', () => {
  it('removes a property and deletes its item values', async () => {
    const { ctx, deletedIds, patchedRows, state } = createPropertiesCtx(
      { subject: 'user_b' },
      [sharedList],
      [priorityProperty, dueDateProperty, notesProperty],
      [
        {
          _id: 'value_priority_item_a',
          listId: sharedList._id,
          listItemId: 'item_a',
          listPropertyId: priorityProperty._id,
          selectOptionId: 'opt_high',
          createdAt: 1,
          updatedAt: 1
        },
        {
          _id: 'value_priority_item_b',
          listId: sharedList._id,
          listItemId: 'item_b',
          listPropertyId: priorityProperty._id,
          selectOptionId: 'opt_low',
          createdAt: 1,
          updatedAt: 1
        }
      ]
    );
    vi.spyOn(Date, 'now').mockReturnValue(275);

    await expect(
      removeListPropertyHandler(ctx as never, { propertyId: listPropertyId('prop_priority') })
    ).resolves.toEqual({
      propertyId: listPropertyId('prop_priority'),
      removedValueIds: ['value_priority_item_a', 'value_priority_item_b']
    });

    expect(deletedIds).toEqual(['value_priority_item_a', 'value_priority_item_b', 'prop_priority']);
    expect(patchedRows).toEqual([
      {
        id: 'prop_due_date',
        patch: {
          sortOrder: 0,
          updatedAt: 275
        }
      },
      {
        id: 'prop_notes',
        patch: {
          sortOrder: 1,
          updatedAt: 275
        }
      }
    ]);
    expect(state.properties.map((property) => [property._id, property.sortOrder])).toEqual([
      ['prop_due_date', 0],
      ['prop_notes', 1]
    ]);
    expect(state.values).toEqual([]);
  });
});

describe('replaceListPropertyOptions', () => {
  it('replaces select options and deletes values for removed options', async () => {
    const { ctx, deletedIds, patchedRows, state } = createPropertiesCtx(
      { subject: 'user_b' },
      [sharedList],
      [priorityProperty],
      [
        {
          _id: 'value_priority_item_a',
          listId: sharedList._id,
          listItemId: 'item_a',
          listPropertyId: priorityProperty._id,
          selectOptionId: 'opt_high',
          createdAt: 1,
          updatedAt: 1
        },
        {
          _id: 'value_priority_item_b',
          listId: sharedList._id,
          listItemId: 'item_b',
          listPropertyId: priorityProperty._id,
          selectOptionId: 'opt_low',
          createdAt: 1,
          updatedAt: 1
        }
      ]
    );
    vi.spyOn(Date, 'now').mockReturnValue(280);

    await expect(
      replaceListPropertyOptionsHandler(ctx as never, {
        propertyId: listPropertyId('prop_priority'),
        options: [
          { id: 'opt_high', label: 'High priority' },
          { id: 'opt_soon', label: 'Soon' }
        ]
      })
    ).resolves.toMatchObject({
      _id: 'prop_priority',
      options: [
        { id: 'opt_high', label: 'High priority' },
        { id: 'opt_soon', label: 'Soon' }
      ],
      updatedAt: 280
    });

    expect(patchedRows).toEqual([
      {
        id: 'prop_priority',
        patch: {
          options: [
            { id: 'opt_high', label: 'High priority' },
            { id: 'opt_soon', label: 'Soon' }
          ],
          updatedAt: 280
        }
      }
    ]);
    expect(deletedIds).toEqual(['value_priority_item_b']);
    expect(state.values).toEqual([
      expect.objectContaining({
        _id: 'value_priority_item_a',
        selectOptionId: 'opt_high'
      })
    ]);
  });

  it('rejects replacing options on a non-select property', async () => {
    const { ctx } = createPropertiesCtx({ subject: 'user_b' }, [sharedList], [notesProperty]);

    await expect(
      replaceListPropertyOptionsHandler(ctx as never, {
        propertyId: listPropertyId('prop_notes'),
        options: [{ id: 'opt_unused', label: 'Unused' }]
      })
    ).rejects.toThrow('List property options are only supported for select properties');
  });
});
