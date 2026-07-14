import { describe, expect, it } from 'vitest';

import {
  applyCategorisationAssignmentsHandler,
  categoriseListItems,
  createOpenAiListCategorisationProvider,
  requestListCategorisationHandler
} from './categorisation';
import { activeItemA, activeItemB, completedItem, personalList, priorityProperty, sharedList } from './testHelpers';

const input = {
  instruction: 'Choose the store section for each grocery item.',
  options: [
    { id: 'bread', label: 'Breads' },
    { id: 'frozen', label: 'Frozen' }
  ],
  items: [
    { itemId: 'item_bread', title: 'Sourdough', updatedAt: 10 },
    { itemId: 'item_ice', title: 'Ice cream', notes: 'Vanilla', updatedAt: 11 }
  ]
};

describe('categoriseListItems', () => {
  it('applies only validated option choices using the current item versions', async () => {
    const received: unknown[] = [];
    const applied: unknown[] = [];

    const result = await categoriseListItems({
      input,
      provider: async (providerInput) => {
        received.push(providerInput);
        return {
          assignments: [
            { itemIndex: 0, optionId: 'bread' },
            { itemIndex: 1, optionId: 'frozen' }
          ]
        };
      },
      applyAssignments: async (assignments) => {
        applied.push(...assignments);
        return { appliedCount: assignments.length };
      }
    });

    expect(received).toEqual([
      {
        instruction: input.instruction,
        options: input.options,
        items: [{ title: 'Sourdough' }, { title: 'Ice cream', notes: 'Vanilla' }]
      }
    ]);
    expect(applied).toEqual([
      { itemId: 'item_bread', expectedUpdatedAt: 10, optionId: 'bread' },
      { itemId: 'item_ice', expectedUpdatedAt: 11, optionId: 'frozen' }
    ]);
    expect(result).toEqual({ status: 'applied', assignmentCount: 2 });
  });

  it('leaves every item unassigned when the provider returns an invalid option', async () => {
    const applied: unknown[] = [];

    const result = await categoriseListItems({
      input,
      provider: async () => ({
        assignments: [
          { itemIndex: 0, optionId: 'bread' },
          { itemIndex: 1, optionId: 'invented' }
        ]
      }),
      applyAssignments: async (assignments) => {
        applied.push(...assignments);
        return { appliedCount: assignments.length };
      }
    });

    expect(applied).toEqual([]);
    expect(result).toEqual({ status: 'skipped', reason: 'invalid_response' });
  });

  it('keeps uncertain items unassigned without failing assignments for certain items', async () => {
    const applied: unknown[] = [];

    const result = await categoriseListItems({
      input,
      provider: async () => ({
        assignments: [
          { itemIndex: 0, optionId: 'bread' },
          { itemIndex: 1, optionId: null }
        ]
      }),
      applyAssignments: async (assignments) => {
        applied.push(...assignments);
        return { appliedCount: assignments.length };
      }
    });

    expect(applied).toEqual([{ itemId: 'item_bread', expectedUpdatedAt: 10, optionId: 'bread' }]);
    expect(result).toEqual({ status: 'applied', assignmentCount: 1 });
  });

  it('reports only assignments that persisted after guarded writes', async () => {
    const result = await categoriseListItems({
      input,
      provider: async () => ({
        assignments: [
          { itemIndex: 0, optionId: 'bread' },
          { itemIndex: 1, optionId: 'frozen' }
        ]
      }),
      applyAssignments: async () => ({ appliedCount: 0 })
    });

    expect(result).toEqual({ status: 'applied', assignmentCount: 0 });
  });

  it('does not apply an assignment when the provider is unavailable', async () => {
    const applied: unknown[] = [];

    const result = await categoriseListItems({
      input,
      provider: async () => {
        throw new Error('timeout');
      },
      applyAssignments: async (assignments) => {
        applied.push(...assignments);
        return { appliedCount: assignments.length };
      }
    });

    expect(applied).toEqual([]);
    expect(result).toEqual({ status: 'failed', reason: 'provider_failure' });
  });
});

describe('createOpenAiListCategorisationProvider', () => {
  it('constrains the structured response to the supplied option ids and item count', async () => {
    const requests: Array<{ body: Record<string, unknown> }> = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      requests.push({ body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  assignments: [
                    { itemIndex: 0, optionId: 'bread' },
                    { itemIndex: 1, optionId: 'frozen' }
                  ]
                })
              }
            }
          ]
        }),
        { status: 200 }
      );
    };
    const provider = createOpenAiListCategorisationProvider({ apiKey: 'test-key', model: 'test-model', fetchImpl });

    await provider({
      instruction: input.instruction,
      options: input.options,
      items: input.items.map(({ title, notes }) => (notes ? { title, notes } : { title }))
    });

    const schema = (
      (requests[0]?.body.response_format as { json_schema: { schema: Record<string, unknown> } }).json_schema.schema
        .properties as {
        assignments: { minItems?: number; maxItems?: number; items: { properties: Record<string, unknown> } };
      }
    ).assignments;
    expect(schema.minItems).toBe(2);
    expect(schema.maxItems).toBe(2);
    expect(schema.items.properties.optionId).toEqual({
      type: ['string', 'null'],
      enum: ['bread', 'frozen', null]
    });
  });
});

describe('applyCategorisationAssignments', () => {
  it('only applies a current assignment when an item remains active and unassigned', async () => {
    const property = {
      _id: 'property_section',
      listId: 'list_1',
      type: 'select' as const,
      options: [{ id: 'bread', label: 'Breads' }],
      categorisationInstruction: 'Choose the store section.'
    };
    const rows = new Map<string, Record<string, unknown>>([
      [property._id, property],
      ['item_current', { _id: 'item_current', listId: 'list_1', updatedAt: 10 }],
      ['item_stale', { _id: 'item_stale', listId: 'list_1', updatedAt: 12 }],
      ['item_completed', { _id: 'item_completed', listId: 'list_1', updatedAt: 10, completedAt: 20 }]
    ]);
    const inserted: unknown[] = [];

    const result = await applyCategorisationAssignmentsHandler(
      {
        db: {
          get: async (id: string) => rows.get(id) ?? null,
          insert: async (_table: string, row: unknown) => {
            inserted.push(row);
            return 'value_1';
          },
          query: () => ({
            withIndex: (_index: string, apply: (query: { eq: (field: string, value: string) => unknown }) => void) => {
              const query = { eq: () => query };
              apply(query);
              return { unique: async () => null };
            }
          })
        }
      } as never,
      {
        propertyId: property._id as never,
        assignments: [
          { itemId: 'item_current', expectedUpdatedAt: 10, optionId: 'bread' },
          { itemId: 'item_stale', expectedUpdatedAt: 10, optionId: 'bread' },
          { itemId: 'item_completed', expectedUpdatedAt: 10, optionId: 'bread' }
        ]
      }
    );

    expect(result).toEqual({ appliedCount: 1 });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      listId: 'list_1',
      listItemId: 'item_current',
      listPropertyId: 'property_section',
      selectOptionId: 'bread'
    });
  });
});

function createRequestCtx({
  currentUserId = 'user_b',
  list = sharedList,
  properties = [priorityProperty],
  items = [activeItemA, activeItemB, completedItem],
  values = [] as Array<{ listItemId: string; listPropertyId: string }>
} = {}) {
  const scheduled: unknown[][] = [];
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: currentUserId }) },
    scheduler: { runAfter: async (...args: unknown[]) => scheduled.push(args) },
    db: {
      query: (table: string) => ({
        withIndex: (index: string, apply: (query: { eq: (field: string, value: string) => unknown }) => unknown) => {
          const queryValues: string[] = [];
          const query = {
            eq: (_field: string, value: string) => {
              queryValues.push(value);
              return query;
            }
          };
          apply(query);

          if (table === 'lists') {
            expect(index).toBe('by_public_id');
            return { unique: async () => (list.publicId === queryValues[0] ? list : null) };
          }
          if (table === 'listProperties') {
            expect(index).toBe('by_list_id');
            return { collect: async () => properties.filter((property) => property.listId === queryValues[0]) };
          }
          if (table === 'listItems') {
            expect(index).toBe('by_list_id');
            return { collect: async () => items.filter((item) => item.listId === queryValues[0]) };
          }
          if (table === 'listItemPropertyValues') {
            expect(index).toBe('by_item_id_and_property_id');
            return {
              unique: async () =>
                values.find(
                  (value) => value.listItemId === queryValues[0] && value.listPropertyId === queryValues[1]
                ) ?? null
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }
      })
    }
  };
  return { ctx, scheduled };
}

describe('requestListCategorisation', () => {
  it('rejects access to another user’s personal list', async () => {
    const { ctx, scheduled } = createRequestCtx({ list: personalList });

    await expect(
      requestListCategorisationHandler(ctx as never, { listPublicId: personalList.publicId })
    ).rejects.toThrow('List unavailable');
    expect(scheduled).toEqual([]);
  });

  it('requires a configured property with options', async () => {
    const { ctx, scheduled } = createRequestCtx({
      properties: [{ ...priorityProperty, categorisationInstruction: 'Use the existing sections.', options: [] }]
    });

    await expect(requestListCategorisationHandler(ctx as never, { listPublicId: sharedList.publicId })).rejects.toThrow(
      'No AI categorisation property is configured'
    );
    expect(scheduled).toEqual([]);
  });

  it('schedules only active items that are still Unassigned', async () => {
    const configuredProperty = { ...priorityProperty, categorisationInstruction: 'Use the existing sections.' };
    const { ctx, scheduled } = createRequestCtx({
      properties: [configuredProperty],
      values: [{ listItemId: activeItemB._id, listPropertyId: configuredProperty._id }]
    });

    await expect(
      requestListCategorisationHandler(ctx as never, { listPublicId: sharedList.publicId })
    ).resolves.toEqual({ scheduledCount: 1 });
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.[2]).toEqual({ listId: sharedList._id, itemIds: [activeItemA._id] });
  });
});
