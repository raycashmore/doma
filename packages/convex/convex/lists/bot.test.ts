import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addressableListsForBotHandler,
  createListItemsForBotHandler,
  defaultListForBotHandler,
  parseListItemsForBotHandler
} from './bot';
import type { ListsBotMutationCtx } from './botModel';
import {
  createListItemsForUser,
  readAddressableListsForUser,
  readDefaultListForUser,
  readMealPlanningListForUser,
  setDefaultListForUser
} from './botModel';
import type { ListsMutationCtx } from './items';

type Row = Record<string, unknown> & { _id: string };

function createCtx(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    lists: [],
    listItems: [],
    listDefaults: [],
    ...structuredClone(seed)
  };
  let nextId = 1;
  const scheduled: unknown[][] = [];

  const allRows = () => Object.values(tables).flat();

  const ctx = {
    db: {
      get: async (id: string) => allRows().find((row) => row._id === id) ?? null,
      insert: async (table: string, row: Record<string, unknown>) => {
        const _id = `${table}_${nextId++}`;
        (tables[table] ??= []).push({ ...row, _id });
        return _id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        const row = allRows().find((candidate) => candidate._id === id);
        if (row) Object.assign(row, patch);
      },
      query: (table: string) => {
        const rows = () => tables[table] ?? [];
        return {
          withIndex: (_index: string, apply: (q: { eq: (field: string, value: unknown) => unknown }) => void) => {
            const eqs: Record<string, unknown> = {};
            const builder = {
              eq: (field: string, value: unknown) => {
                eqs[field] = value;
                return builder;
              }
            };
            apply(builder);
            const match = (row: Row) => Object.entries(eqs).every(([field, value]) => row[field] === value);
            return {
              unique: async () => rows().find(match) ?? null,
              collect: async () => rows().filter(match)
            };
          },
          collect: async () => rows()
        };
      }
    },
    scheduler: {
      runAfter: async (...args: unknown[]) => {
        scheduled.push(args);
        return 'scheduled';
      }
    }
  };

  return { ctx: ctx as unknown as ListsMutationCtx & ListsBotMutationCtx, scheduled, tables };
}

const sharedList: Row = {
  _id: 'lists_shared',
  publicId: 'list_shared',
  name: 'Shopping',
  slug: 'shopping',
  visibility: 'shared',
  createdByUserId: 'user_a',
  createdAt: 1,
  updatedAt: 1
};

describe('default list for a household user', () => {
  it('stores the default by list id and reads it back as a publicId', async () => {
    const { ctx } = createCtx({ lists: [sharedList] });

    await setDefaultListForUser(ctx, { currentUserId: 'user_b', publicId: 'list_shared' });

    await expect(readDefaultListForUser(ctx, { currentUserId: 'user_b' })).resolves.toEqual({
      publicId: 'list_shared',
      name: 'Shopping'
    });
  });

  it('keeps working after the list is renamed (stored by id)', async () => {
    const { ctx, tables } = createCtx({ lists: [sharedList] });
    await setDefaultListForUser(ctx, { currentUserId: 'user_b', publicId: 'list_shared' });

    const row = (tables.lists ?? []).find((list) => list.publicId === 'list_shared');
    if (row) row.name = 'Weekly groceries';

    await expect(readDefaultListForUser(ctx, { currentUserId: 'user_b' })).resolves.toEqual({
      publicId: 'list_shared',
      name: 'Weekly groceries'
    });
  });

  it('returns null when the user has no default list', async () => {
    const { ctx } = createCtx({ lists: [sharedList] });
    await expect(readDefaultListForUser(ctx, { currentUserId: 'user_b' })).resolves.toBeNull();
  });

  it('replaces an existing default rather than adding a second row', async () => {
    const otherList: Row = { ...sharedList, _id: 'lists_other', publicId: 'list_other', name: 'Hardware' };
    const { ctx, tables } = createCtx({ lists: [sharedList, otherList] });

    await setDefaultListForUser(ctx, { currentUserId: 'user_b', publicId: 'list_shared' });
    await setDefaultListForUser(ctx, { currentUserId: 'user_b', publicId: 'list_other' });

    expect((tables.listDefaults ?? []).filter((row) => row.userId === 'user_b')).toHaveLength(1);
    await expect(readDefaultListForUser(ctx, { currentUserId: 'user_b' })).resolves.toEqual({
      publicId: 'list_other',
      name: 'Hardware'
    });
  });

  it('allows defaulting to the user’s own personal list', async () => {
    const ownPersonal: Row = {
      _id: 'lists_own',
      publicId: 'list_own',
      name: 'My errands',
      slug: 'my-errands',
      visibility: 'personal',
      createdByUserId: 'user_b',
      createdAt: 1,
      updatedAt: 1
    };
    const { ctx } = createCtx({ lists: [ownPersonal] });

    await setDefaultListForUser(ctx, { currentUserId: 'user_b', publicId: 'list_own' });

    await expect(readDefaultListForUser(ctx, { currentUserId: 'user_b' })).resolves.toEqual({
      publicId: 'list_own',
      name: 'My errands'
    });
  });

  it('refuses to default to another user’s personal list', async () => {
    const personalList: Row = {
      _id: 'lists_personal',
      publicId: 'list_personal',
      name: 'Private',
      slug: 'private',
      visibility: 'personal',
      createdByUserId: 'user_a',
      createdAt: 1,
      updatedAt: 1
    };
    const { ctx } = createCtx({ lists: [personalList] });

    await expect(setDefaultListForUser(ctx, { currentUserId: 'user_b', publicId: 'list_personal' })).rejects.toThrow(
      'List unavailable'
    );
  });
});

describe('readAddressableListsForUser', () => {
  const ownPersonal: Row = {
    _id: 'lists_own',
    publicId: 'list_own',
    name: 'My errands',
    slug: 'my-errands',
    visibility: 'personal',
    createdByUserId: 'user_b',
    createdAt: 1,
    updatedAt: 1
  };
  const otherPersonal: Row = {
    _id: 'lists_other_personal',
    publicId: 'list_other_personal',
    name: 'Their secrets',
    slug: 'their-secrets',
    visibility: 'personal',
    createdByUserId: 'user_a',
    createdAt: 1,
    updatedAt: 1
  };

  it('returns the user’s own personal lists plus every shared list, by id and name', async () => {
    const { ctx } = createCtx({ lists: [sharedList, ownPersonal, otherPersonal] });

    const result = await readAddressableListsForUser(ctx, { currentUserId: 'user_b' });

    // Shared list (created by user_a) + user_b's own personal list; not user_a's personal list.
    expect(result).toEqual(
      expect.arrayContaining([
        { id: 'list_shared', name: 'Shopping' },
        { id: 'list_own', name: 'My errands' }
      ])
    );
    expect(result).toHaveLength(2);
    expect(result.map((list) => list.id)).not.toContain('list_other_personal');
  });

  it('does not duplicate a shared list the requesting user created', async () => {
    // sharedList is created by user_a; make the requester its creator so it is
    // returned by both the by_created_by and by_visibility index reads.
    const ownShared: Row = { ...sharedList, createdByUserId: 'user_b' };
    const { ctx } = createCtx({ lists: [ownShared] });

    const result = await readAddressableListsForUser(ctx, { currentUserId: 'user_b' });

    expect(result).toEqual([{ id: 'list_shared', name: 'Shopping' }]);
  });
});

describe('readMealPlanningListForUser', () => {
  it('returns only active recipe items and their list property values', async () => {
    const { ctx } = createCtx({
      lists: [sharedList],
      listItems: [
        { _id: 'item_active', listId: 'lists_shared', title: 'Pasta bake', sortOrder: 0, createdAt: 1, updatedAt: 1 },
        {
          _id: 'item_done',
          listId: 'lists_shared',
          title: 'Old recipe',
          sortOrder: 1,
          completedAt: 2,
          createdAt: 1,
          updatedAt: 2
        }
      ],
      listProperties: [
        {
          _id: 'property_ingredients',
          listId: 'lists_shared',
          name: 'Ingredients',
          type: 'text',
          sortOrder: 0,
          createdAt: 1,
          updatedAt: 1
        }
      ],
      listItemPropertyValues: [
        {
          _id: 'value_ingredients',
          listId: 'lists_shared',
          listItemId: 'item_active',
          listPropertyId: 'property_ingredients',
          textValue: 'Pasta\nSauce',
          createdAt: 1,
          updatedAt: 1
        }
      ]
    });

    await expect(
      readMealPlanningListForUser(ctx, { currentUserId: 'user_b', publicId: 'list_shared' })
    ).resolves.toEqual({
      publicId: 'list_shared',
      name: 'Shopping',
      properties: [{ id: 'property_ingredients', name: 'Ingredients', type: 'text', options: undefined }],
      activeItems: [
        {
          id: 'item_active',
          title: 'Pasta bake',
          propertyValues: [
            {
              propertyId: 'property_ingredients',
              textValue: 'Pasta\nSauce',
              numberValue: undefined,
              selectOptionId: undefined
            }
          ]
        }
      ]
    });
  });
});

describe('createListItemsForUser', () => {
  it('creates title-only items in the target list, trimming and dropping blanks', async () => {
    const { ctx, tables } = createCtx({ lists: [sharedList] });

    const result = await createListItemsForUser(ctx, {
      currentUserId: 'user_b',
      listPublicId: 'list_shared',
      titles: ['  milk ', 'bread', '   ', 'eggs']
    });

    expect(result.list).toEqual({ publicId: 'list_shared', name: 'Shopping' });
    expect(result.items.map((item) => item.title)).toEqual(['milk', 'bread', 'eggs']);

    const stored = (tables.listItems ?? []).map((item) => ({ title: item.title, listId: item.listId }));
    expect(stored).toEqual([
      { title: 'milk', listId: 'lists_shared' },
      { title: 'bread', listId: 'lists_shared' },
      { title: 'eggs', listId: 'lists_shared' }
    ]);
    // Title-only: no notes or property values written.
    expect((tables.listItems ?? []).every((item) => item.notes === undefined)).toBe(true);
  });

  it('refuses to create items in another user’s personal list', async () => {
    const personalList: Row = {
      _id: 'lists_personal',
      publicId: 'list_personal',
      name: 'Private',
      slug: 'private',
      visibility: 'personal',
      createdByUserId: 'user_a',
      createdAt: 1,
      updatedAt: 1
    };
    const { ctx } = createCtx({ lists: [personalList] });

    await expect(
      createListItemsForUser(ctx, { currentUserId: 'user_b', listPublicId: 'list_personal', titles: ['milk'] })
    ).rejects.toThrow('List unavailable');
  });
});

describe('bot function service-token guard', () => {
  beforeEach(() => {
    process.env.BOT_SERVICE_TOKEN = 'service-token';
  });

  afterEach(() => {
    delete process.env.BOT_SERVICE_TOKEN;
  });

  it('allows reads, writes, and parsing with a valid token', async () => {
    const { ctx, scheduled } = createCtx({ lists: [sharedList] });

    await expect(
      defaultListForBotHandler(ctx, { serviceToken: 'service-token', clerkUserId: 'user_b' })
    ).resolves.toBeNull();

    await expect(
      addressableListsForBotHandler(ctx, { serviceToken: 'service-token', clerkUserId: 'user_b' })
    ).resolves.toEqual([{ id: 'list_shared', name: 'Shopping' }]);

    const created = await createListItemsForBotHandler(ctx, {
      serviceToken: 'service-token',
      clerkUserId: 'user_b',
      listPublicId: 'list_shared',
      titles: ['milk']
    });
    expect(created.items.map((item) => item.title)).toEqual(['milk']);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.[2]).toEqual({ listId: sharedList._id, itemIds: ['listItems_1'] });

    // No OPENAI_API_KEY/LIST_ITEMS_AI_MODEL set, so parsing uses the deterministic fallback.
    await expect(parseListItemsForBotHandler({ serviceToken: 'service-token', messageText: 'a\nb' })).resolves.toEqual({
      targetListId: null,
      items: ['a', 'b']
    });
  });

  it('rejects an invalid token on every bot function and writes nothing', async () => {
    const { ctx, tables } = createCtx({ lists: [sharedList] });

    await expect(defaultListForBotHandler(ctx, { serviceToken: 'wrong', clerkUserId: 'user_b' })).rejects.toThrow(
      'Unauthorized'
    );
    await expect(addressableListsForBotHandler(ctx, { serviceToken: 'wrong', clerkUserId: 'user_b' })).rejects.toThrow(
      'Unauthorized'
    );
    await expect(
      createListItemsForBotHandler(ctx, {
        serviceToken: 'wrong',
        clerkUserId: 'user_b',
        listPublicId: 'list_shared',
        titles: ['milk']
      })
    ).rejects.toThrow('Unauthorized');
    await expect(parseListItemsForBotHandler({ serviceToken: 'wrong', messageText: 'a\nb' })).rejects.toThrow(
      'Unauthorized'
    );

    expect(tables.listItems ?? []).toHaveLength(0);
  });

  it('rejects when no service token is configured', async () => {
    delete process.env.BOT_SERVICE_TOKEN;
    const { ctx } = createCtx({ lists: [sharedList] });

    await expect(defaultListForBotHandler(ctx, { serviceToken: '', clerkUserId: 'user_b' })).rejects.toThrow(
      'Unauthorized'
    );
    await expect(addressableListsForBotHandler(ctx, { serviceToken: '', clerkUserId: 'user_b' })).rejects.toThrow(
      'Unauthorized'
    );
  });
});
