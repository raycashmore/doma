import { afterEach, describe, expect, it, vi } from 'vitest';

import * as itemsModule from './items';
import * as propertiesModule from './properties';
import {
  activeItemA,
  activeItemB,
  completedItem,
  dueDateProperty,
  dueDateValueForItemA,
  getFutureHandler,
  listItemId,
  listPropertyId,
  notesProperty,
  notesValueForItemA,
  personalList,
  priorityProperty,
  priorityValueForCompletedItem,
  priorityValueForItemA,
  quantityProperty,
  sharedList,
  type TestListItemPropertyValueRow,
  type TestListItemRow,
  type TestListPropertyRow,
  type TestListRow,
  urgentProperty} from './testHelpers';

type FutureListPropertiesModule = typeof propertiesModule & {
  clearListItemPropertyValueHandler: (...args: unknown[]) => Promise<unknown>;
  setListItemPropertyValueHandler: (...args: unknown[]) => Promise<unknown>;
};

const {
  clearCompletedListItemsHandler,
  completeListItemHandler,
  createListItemHandler,
  deleteListItemHandler,
  readVisibleListItemsByPublicId,
  renameListItemHandler,
  reorderListItemHandler,
  uncompleteListItemHandler
} = itemsModule;

const clearListItemPropertyValueHandler = getFutureHandler<
  FutureListPropertiesModule['clearListItemPropertyValueHandler']
>(
  propertiesModule,
  'clearListItemPropertyValueHandler'
);
const setListItemPropertyValueHandler = getFutureHandler<
  FutureListPropertiesModule['setListItemPropertyValueHandler']
>(
  propertiesModule,
  'setListItemPropertyValueHandler'
);

function createItemsCtx(
  identity: { subject: string } | null,
  lists: readonly TestListRow[] = [],
  items: readonly TestListItemRow[] = [],
  properties: readonly TestListPropertyRow[] = [],
  values: readonly TestListItemPropertyValueRow[] = []
) {
  const state = {
    lists: [...lists],
    items: [...items],
    properties: [...properties],
    values: [...values]
  };

  const insertedRows: Array<Record<string, unknown>> = [];
  const patchedRows: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const deletedIds: string[] = [];
  const queriedValueIndexes: string[] = [];

  const ctx = {
    auth: {
      getUserIdentity: async () => identity
    },
    db: {
      get: async (id: string) => {
        const listMatch = state.lists.find((row) => row._id === id);
        if (listMatch) return listMatch;

        const itemMatch = state.items.find((row) => row._id === id);
        if (itemMatch) return itemMatch;

        const propertyMatch = state.properties.find((row) => row._id === id);
        if (propertyMatch) return propertyMatch;

        return state.values.find((row) => row._id === id) ?? null;
      },
      insert: async (table: string, row: Record<string, unknown>) => {
        if (table === 'listItems') {
          insertedRows.push(row);
          return 'new_item_id';
        }

        if (table === 'listItemPropertyValues') {
          insertedRows.push(row);
          state.values.push({ ...(row as TestListItemPropertyValueRow), _id: 'new_value_id' });
          return 'new_value_id';
        }

        throw new Error(`Unexpected insert table ${table}`);
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        patchedRows.push({ id, patch });
        state.items = state.items.map((item) => (item._id === id ? { ...item, ...patch } : item));
        state.values = state.values.map((value) => (value._id === id ? { ...value, ...patch } : value));
      },
      delete: async (id: string) => {
        deletedIds.push(id);
        state.items = state.items.filter((item) => item._id !== id);
        state.values = state.values.filter((value) => value._id !== id);
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
            withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
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

        if (table === 'listProperties') {
          return {
            collect: async () => [...state.properties],
            withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
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
                  collect: async () => state.properties.filter((row) => row.listId === filterValue)
                };
              }

              throw new Error(`Unexpected listProperties index ${index}`);
            }
          };
        }

        if (table === 'listItemPropertyValues') {
          return {
            collect: async () => [...state.values],
            withIndex: (
              index: string,
              apply: (q: {
                eq: (field: string, value: string) => { eq: (field: string, value: string) => unknown };
              }) => unknown
            ) => {
              const filters: Array<{ field: string; value: string }> = [];
              apply({
                eq: (field, value) => {
                  filters.push({ field, value });
                  return {
                    eq: (nextField: string, nextValue: string) => {
                      filters.push({ field: nextField, value: nextValue });
                      return nextValue;
                    }
                  };
                }
              });

              queriedValueIndexes.push(index);

              if (index === 'by_item_id_and_property_id') {
                expect(filters).toEqual([
                  { field: 'listItemId', value: expect.any(String) },
                  { field: 'listPropertyId', value: expect.any(String) }
                ]);

                return {
                  unique: async () =>
                    state.values.find(
                      (row) => row.listItemId === filters[0]?.value && row.listPropertyId === filters[1]?.value
                    ) ?? null
                };
              }

              if (index === 'by_list_id') {
                expect(filters).toEqual([{ field: 'listId', value: expect.any(String) }]);
                return {
                  collect: async () => state.values.filter((row) => row.listId === filters[0]?.value)
                };
              }

              throw new Error(`Unexpected listItemPropertyValues index ${index}`);
            }
          };
        }

        throw new Error(`Unexpected query table ${table}`);
      }
    }
  };

  return { ctx, insertedRows, patchedRows, deletedIds, queriedValueIndexes, state };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getFutureHandler', () => {
  it('rejects with an explicit not-implemented error when a handler export is missing', async () => {
    const missingHandler = getFutureHandler<(...args: unknown[]) => Promise<unknown>>({}, 'futureHandler');

    await expect(missingHandler('arg')).rejects.toThrow('futureHandler is not implemented');
  });
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

  it('returns ordered list properties alongside visible list items', async () => {
    const { ctx, queriedValueIndexes } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [{ ...completedItem, completedAt: 175 }, activeItemA, activeItemB],
      [dueDateProperty, priorityProperty],
      [priorityValueForCompletedItem, dueDateValueForItemA, priorityValueForItemA]
    );

    await expect(
      readVisibleListItemsByPublicId(ctx as never, { publicId: sharedList.publicId })
    ).resolves.toMatchObject({
      list: { publicId: sharedList.publicId },
      properties: [
        { _id: 'prop_priority', name: 'Priority', type: 'select', sortOrder: 0 },
        { _id: 'prop_due_date', name: 'Due date', type: 'date', sortOrder: 1 }
      ],
      activeItems: [
        {
          _id: activeItemA._id,
          propertyValues: [
            { _id: 'value_priority_item_a', listPropertyId: 'prop_priority', selectOptionId: 'opt_high' },
            { _id: 'value_due_date_item_a', listPropertyId: 'prop_due_date', dateValue: 1_720_000_000_000 }
          ]
        },
        {
          _id: activeItemB._id,
          propertyValues: []
        }
      ],
      completedItems: [
        {
          _id: completedItem._id,
          completedAt: 175,
          propertyValues: [{ _id: 'value_priority_item_c', listPropertyId: 'prop_priority', selectOptionId: 'opt_low' }]
        }
      ]
    });

    expect(queriedValueIndexes).toEqual(['by_list_id']);
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
  it('deletes an item from a visible shared list and removes its property values', async () => {
    const { ctx, deletedIds, state } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA],
      [notesProperty],
      [notesValueForItemA]
    );

    await expect(deleteListItemHandler(ctx as never, { itemId: listItemId(activeItemA._id) })).resolves.toEqual({
      itemId: listItemId(activeItemA._id)
    });

    expect(deletedIds).toEqual(['value_notes_item_a', activeItemA._id]);
    expect(state.values).toEqual([]);
  });
});

describe('completeListItem', () => {
  it('marks an active item complete and removes it from active ordering', async () => {
    const { ctx, patchedRows, state } = createItemsCtx({ subject: 'user_b' }, [sharedList], [activeItemA]);
    vi.spyOn(Date, 'now').mockReturnValue(250);

    await expect(completeListItemHandler(ctx as never, { itemId: listItemId(activeItemA._id) })).resolves.toMatchObject(
      {
        _id: activeItemA._id,
        completedAt: 250
      }
    );

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

    await expect(
      uncompleteListItemHandler(ctx as never, { itemId: listItemId(completedItem._id) })
    ).resolves.toMatchObject({
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
      [
        activeItemA,
        activeItemB,
        { ...activeItemB, _id: 'item_d', title: 'Bread', sortOrder: 2, createdAt: 4, updatedAt: 4 }
      ]
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
  it('deletes all completed items from a visible shared list and removes their property values', async () => {
    const { ctx, deletedIds, state } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA, completedItem, { ...completedItem, _id: 'item_done_2', completedAt: 200 }],
      [priorityProperty],
      [
        priorityValueForCompletedItem,
        {
          _id: 'value_priority_item_done_2',
          listId: sharedList._id,
          listItemId: 'item_done_2',
          listPropertyId: priorityProperty._id,
          selectOptionId: 'opt_high',
          createdAt: 2,
          updatedAt: 2
        }
      ]
    );

    await expect(
      clearCompletedListItemsHandler(ctx as never, {
        listPublicId: sharedList.publicId
      })
    ).resolves.toEqual({
      removedItemIds: ['item_done_2', 'item_c']
    });

    expect(deletedIds).toEqual([
      'value_priority_item_c',
      'value_priority_item_done_2',
      'item_done_2',
      'item_c'
    ]);
    expect(state.values).toEqual([]);
  });
});

describe('setListItemPropertyValue', () => {
  it('sets and clears a text property value for an editable item', async () => {
    const { ctx, deletedIds, insertedRows, patchedRows, state } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA],
      [priorityProperty, notesProperty]
    );
    vi.spyOn(Date, 'now').mockReturnValue(410);

    await expect(
      setListItemPropertyValueHandler(ctx as never, {
        itemId: listItemId(activeItemA._id),
        propertyId: listPropertyId('prop_notes'),
        value: { type: 'text', text: 'Buy green bananas' }
      })
    ).resolves.toMatchObject({
      listId: sharedList._id,
      listItemId: activeItemA._id,
      listPropertyId: 'prop_notes',
      textValue: 'Buy green bananas',
      createdAt: 410,
      updatedAt: 410
    });

    expect(insertedRows).toEqual([
      {
        listId: sharedList._id,
        listItemId: activeItemA._id,
        listPropertyId: 'prop_notes',
        textValue: 'Buy green bananas',
        createdAt: 410,
        updatedAt: 410
      }
    ]);
    expect(patchedRows).toEqual([
      {
        id: activeItemA._id,
        patch: {
          updatedAt: activeItemA.updatedAt
        }
      }
    ]);
    expect(
      state.values.some(
        (value) =>
          value.listItemId === activeItemA._id &&
          value.listPropertyId === 'prop_notes' &&
          value.textValue === 'Buy green bananas'
      )
    ).toBe(true);

    await expect(
      clearListItemPropertyValueHandler(ctx as never, {
        itemId: listItemId(activeItemA._id),
        propertyId: listPropertyId('prop_notes')
      })
    ).resolves.toEqual({
      itemId: listItemId(activeItemA._id),
      propertyId: listPropertyId('prop_notes')
    });

    expect(patchedRows).toEqual([
      {
        id: activeItemA._id,
        patch: {
          updatedAt: activeItemA.updatedAt
        }
      },
      {
        id: activeItemA._id,
        patch: {
          updatedAt: activeItemA.updatedAt
        }
      }
    ]);
    expect(deletedIds).toContain('new_value_id');
    expect(state.values).not.toContainEqual(
      expect.objectContaining({
        listItemId: activeItemA._id,
        listPropertyId: 'prop_notes'
      })
    );
  });

  it('rejects a select value that is not defined on the property', async () => {
    const { ctx } = createItemsCtx({ subject: 'user_b' }, [sharedList], [activeItemA], [priorityProperty]);

    await expect(
      setListItemPropertyValueHandler(ctx as never, {
        itemId: listItemId(activeItemA._id),
        propertyId: listPropertyId('prop_priority'),
        value: { type: 'select', optionId: 'opt_missing' }
      })
    ).rejects.toThrow('List property option is invalid');
  });

  it('sets a select property value for an editable item', async () => {
    const { ctx, insertedRows, state } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA],
      [priorityProperty]
    );
    vi.spyOn(Date, 'now').mockReturnValue(420);

    await expect(
      setListItemPropertyValueHandler(ctx as never, {
        itemId: listItemId(activeItemA._id),
        propertyId: listPropertyId('prop_priority'),
        value: { type: 'select', optionId: 'opt_high' }
      })
    ).resolves.toMatchObject({
      listId: sharedList._id,
      listItemId: activeItemA._id,
      listPropertyId: 'prop_priority',
      selectOptionId: 'opt_high',
      createdAt: 420,
      updatedAt: 420
    });

    expect(insertedRows).toEqual([
      {
        listId: sharedList._id,
        listItemId: activeItemA._id,
        listPropertyId: 'prop_priority',
        selectOptionId: 'opt_high',
        createdAt: 420,
        updatedAt: 420
      }
    ]);
    expect(
      state.values.some(
        (value) =>
          value.listItemId === activeItemA._id &&
          value.listPropertyId === 'prop_priority' &&
          value.selectOptionId === 'opt_high'
      )
    ).toBe(true);
  });

  it('sets a date property value for an editable item', async () => {
    const { ctx, insertedRows, state } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA],
      [dueDateProperty]
    );
    vi.spyOn(Date, 'now').mockReturnValue(430);

    await expect(
      setListItemPropertyValueHandler(ctx as never, {
        itemId: listItemId(activeItemA._id),
        propertyId: listPropertyId('prop_due_date'),
        value: { type: 'date', date: 1_720_000_000_000 }
      })
    ).resolves.toMatchObject({
      listId: sharedList._id,
      listItemId: activeItemA._id,
      listPropertyId: 'prop_due_date',
      dateValue: 1_720_000_000_000,
      createdAt: 430,
      updatedAt: 430
    });

    expect(insertedRows).toEqual([
      {
        listId: sharedList._id,
        listItemId: activeItemA._id,
        listPropertyId: 'prop_due_date',
        dateValue: 1_720_000_000_000,
        createdAt: 430,
        updatedAt: 430
      }
    ]);
    expect(
      state.values.some(
        (value) =>
          value.listItemId === activeItemA._id &&
          value.listPropertyId === 'prop_due_date' &&
          value.dateValue === 1_720_000_000_000
      )
    ).toBe(true);
  });

  it('sets a number property value for an editable item', async () => {
    const { ctx, insertedRows, state } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA],
      [quantityProperty]
    );
    vi.spyOn(Date, 'now').mockReturnValue(440);

    await expect(
      setListItemPropertyValueHandler(ctx as never, {
        itemId: listItemId(activeItemA._id),
        propertyId: listPropertyId('prop_quantity'),
        value: { type: 'number', number: 6 }
      })
    ).resolves.toMatchObject({
      listId: sharedList._id,
      listItemId: activeItemA._id,
      listPropertyId: 'prop_quantity',
      numberValue: 6,
      createdAt: 440,
      updatedAt: 440
    });

    expect(insertedRows).toEqual([
      {
        listId: sharedList._id,
        listItemId: activeItemA._id,
        listPropertyId: 'prop_quantity',
        numberValue: 6,
        createdAt: 440,
        updatedAt: 440
      }
    ]);
    expect(
      state.values.some(
        (value) =>
          value.listItemId === activeItemA._id && value.listPropertyId === 'prop_quantity' && value.numberValue === 6
      )
    ).toBe(true);
  });

  it('sets a checkbox property value for an editable item', async () => {
    const { ctx, insertedRows, state } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA],
      [urgentProperty]
    );
    vi.spyOn(Date, 'now').mockReturnValue(445);

    await expect(
      setListItemPropertyValueHandler(ctx as never, {
        itemId: listItemId(activeItemA._id),
        propertyId: listPropertyId('prop_urgent'),
        value: { type: 'checkbox', checked: true }
      })
    ).resolves.toMatchObject({
      listId: sharedList._id,
      listItemId: activeItemA._id,
      listPropertyId: 'prop_urgent',
      checkboxValue: true,
      createdAt: 445,
      updatedAt: 445
    });

    expect(insertedRows).toEqual([
      {
        listId: sharedList._id,
        listItemId: activeItemA._id,
        listPropertyId: 'prop_urgent',
        checkboxValue: true,
        createdAt: 445,
        updatedAt: 445
      }
    ]);
    expect(
      state.values.some(
        (value) =>
          value.listItemId === activeItemA._id && value.listPropertyId === 'prop_urgent' && value.checkboxValue === true
      )
    ).toBe(true);
  });

  it('updates an existing sparse property-value row for the same item and property', async () => {
    const { ctx, insertedRows, patchedRows, state } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA],
      [notesProperty],
      [notesValueForItemA]
    );
    vi.spyOn(Date, 'now').mockReturnValue(450);

    await expect(
      setListItemPropertyValueHandler(ctx as never, {
        itemId: listItemId(activeItemA._id),
        propertyId: listPropertyId('prop_notes'),
        value: { type: 'text', text: 'Updated notes' }
      })
    ).resolves.toMatchObject({
      _id: 'value_notes_item_a',
      listItemId: activeItemA._id,
      listPropertyId: 'prop_notes',
      textValue: 'Updated notes',
      updatedAt: 450
    });

    expect(insertedRows).toEqual([]);
    expect(patchedRows).toEqual([
      {
        id: activeItemA._id,
        patch: {
          updatedAt: activeItemA.updatedAt
        }
      },
      {
        id: 'value_notes_item_a',
        patch: {
          textValue: 'Updated notes',
          updatedAt: 450
        }
      }
    ]);
    expect(
      state.values.filter((value) => value.listItemId === activeItemA._id && value.listPropertyId === 'prop_notes')
    ).toEqual([
      expect.objectContaining({
        _id: 'value_notes_item_a',
        textValue: 'Updated notes',
        updatedAt: 450
      })
    ]);
  });

  it('clears an existing sparse property-value row for an editable item', async () => {
    const { ctx, deletedIds, patchedRows, state } = createItemsCtx(
      { subject: 'user_b' },
      [sharedList],
      [activeItemA],
      [notesProperty],
      [notesValueForItemA]
    );

    await expect(
      clearListItemPropertyValueHandler(ctx as never, {
        itemId: listItemId(activeItemA._id),
        propertyId: listPropertyId('prop_notes')
      })
    ).resolves.toEqual({
      itemId: listItemId(activeItemA._id),
      propertyId: listPropertyId('prop_notes')
    });

    expect(patchedRows).toEqual([
      {
        id: activeItemA._id,
        patch: {
          updatedAt: activeItemA.updatedAt
        }
      }
    ]);
    expect(deletedIds).toEqual(['value_notes_item_a']);
    expect(state.values).toEqual([]);
  });
});
