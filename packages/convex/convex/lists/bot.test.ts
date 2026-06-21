import { describe, expect, it } from 'vitest';

import { createListItemsForUser, readDefaultListForUser, setDefaultListForUser } from './botModel';
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
    }
  };

  return { ctx: ctx as unknown as ListsMutationCtx, tables };
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
