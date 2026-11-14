import { describe, expect, it } from 'vitest';

import type { ListsMutationCtx } from './items';
import { orderListsForUser, readListOrderPreferences, reorderListForUser } from './orderPreferences';

type Row = Record<string, unknown> & { _id: string };

function list(publicId: string, visibility: 'shared' | 'personal', createdByUserId = 'user_a'): Row {
  return { _id: `row_${publicId}`, publicId, name: publicId, slug: publicId, visibility, createdByUserId };
}

function createCtx(seed: Record<string, Row[]> = {}) {
  const tables = { lists: [] as Row[], listOrderPreferences: [] as Row[], ...structuredClone(seed) } as Record<
    string,
    Row[]
  > & { lists: Row[]; listOrderPreferences: Row[] };
  let nextId = 1;
  const writes: string[] = [];

  const ctx = {
    db: {
      insert: async (table: string, row: Record<string, unknown>) => {
        const _id = `${table}_${nextId++}`;
        (tables[table] ??= []).push({ ...row, _id });
        writes.push(`insert ${String(row.listId)}`);
        return _id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        const row = Object.values(tables)
          .flat()
          .find((candidate) => candidate._id === id);
        if (row) Object.assign(row, patch);
        writes.push(`patch ${String(row?.listId)}`);
      },
      query: (table: string) => ({
        withIndex: (_index: string, apply: (q: { eq: (field: string, value: unknown) => unknown }) => void) => {
          const eqs: Record<string, unknown> = {};
          const builder = {
            eq: (field: string, value: unknown) => {
              eqs[field] = value;
              return builder;
            }
          };
          apply(builder);
          const matches = (row: Row) => Object.entries(eqs).every(([field, value]) => row[field] === value);
          return {
            unique: async () => (tables[table] ?? []).find(matches) ?? null,
            collect: async () => (tables[table] ?? []).filter(matches)
          };
        }
      })
    }
  };

  return { ctx: ctx as unknown as ListsMutationCtx, tables, writes };
}

async function orderFor(ctx: ListsMutationCtx, tables: { lists: Row[] }, userId: string) {
  const preferences = await readListOrderPreferences(ctx, userId);
  return orderListsForUser(tables.lists as Array<Row & { _id: string }>, preferences as never).map(
    (row) => row.publicId
  );
}

describe('orderListsForUser', () => {
  it('keeps creation order when the person has placed nothing', () => {
    const lists = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
    expect(orderListsForUser(lists, [])).toEqual(lists);
  });

  it('puts placed lists first by their order, then unplaced lists in creation order', () => {
    const lists = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }, { _id: 'new' }];
    const preferences = [
      { listId: 'c', sortOrder: 0 },
      { listId: 'a', sortOrder: 1 },
      { listId: 'b', sortOrder: 2 }
    ];
    expect(orderListsForUser(lists, preferences).map((row) => row._id)).toEqual(['c', 'a', 'b', 'new']);
  });
});

describe('reorderListForUser', () => {
  const lists = [list('groceries', 'shared'), list('chores', 'shared'), list('hardware', 'shared')];

  it('moves a list for the current person and leaves everyone else in creation order', async () => {
    const { ctx, tables } = createCtx({ lists });

    await reorderListForUser(ctx, { currentUserId: 'user_a', publicId: 'hardware', targetIndex: 0 });

    expect(await orderFor(ctx, tables, 'user_a')).toEqual(['hardware', 'groceries', 'chores']);
    expect(await orderFor(ctx, tables, 'user_b')).toEqual(['groceries', 'chores', 'hardware']);
  });

  it('puts a list created after a reorder at the end of its tab', async () => {
    const { ctx, tables } = createCtx({ lists });
    await reorderListForUser(ctx, { currentUserId: 'user_a', publicId: 'hardware', targetIndex: 0 });

    tables.lists.push(list('camping', 'shared', 'user_b'));

    expect(await orderFor(ctx, tables, 'user_a')).toEqual(['hardware', 'groceries', 'chores', 'camping']);
  });

  it('only writes the positions that change on a later move', async () => {
    const { ctx, tables, writes } = createCtx({ lists });
    await reorderListForUser(ctx, { currentUserId: 'user_a', publicId: 'hardware', targetIndex: 0 });
    writes.length = 0;

    await reorderListForUser(ctx, { currentUserId: 'user_a', publicId: 'chores', targetIndex: 1 });

    expect(await orderFor(ctx, tables, 'user_a')).toEqual(['hardware', 'chores', 'groceries']);
    expect(writes).toEqual(['patch row_chores', 'patch row_groceries']);
    expect(tables.listOrderPreferences).toHaveLength(3);
  });

  it('clamps an index past the end of the tab', async () => {
    const { ctx, tables } = createCtx({ lists });

    await reorderListForUser(ctx, { currentUserId: 'user_a', publicId: 'groceries', targetIndex: 10 });

    expect(await orderFor(ctx, tables, 'user_a')).toEqual(['chores', 'hardware', 'groceries']);
  });

  it('orders within the moved list’s tab only, skipping other people’s personal lists', async () => {
    const { ctx, tables } = createCtx({
      lists: [
        list('mine', 'personal', 'user_a'),
        list('theirs', 'personal', 'user_b'),
        list('groceries', 'shared'),
        list('also-mine', 'personal', 'user_a')
      ]
    });

    await reorderListForUser(ctx, { currentUserId: 'user_a', publicId: 'also-mine', targetIndex: 0 });

    const placed = tables.listOrderPreferences.map((row) => row.listId);
    expect(placed.sort()).toEqual(['row_also-mine', 'row_mine']);
    expect(await orderFor(ctx, tables, 'user_a')).toEqual(['also-mine', 'mine', 'theirs', 'groceries']);
  });

  it('rejects moving someone else’s personal list', async () => {
    const { ctx, tables } = createCtx({ lists: [list('theirs', 'personal', 'user_b')] });

    await expect(
      reorderListForUser(ctx, { currentUserId: 'user_a', publicId: 'theirs', targetIndex: 0 })
    ).rejects.toThrow('List unavailable');
    expect(tables.listOrderPreferences).toEqual([]);
  });
});
