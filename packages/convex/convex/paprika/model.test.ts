import { describe, expect, it } from 'vitest';

import type { MutationCtx } from '../_generated/server';
import {
  disconnectForUser,
  markNeedsReconnectForUser,
  readConnectionViewForUser,
  readTokenForUser,
  refreshGroceryListsForUser,
  saveConnectionForUser,
  setSourceListForUser,
  setTargetListForUser
} from './model';

type Row = Record<string, unknown> & { _id: string };

function list(publicId: string, name: string, visibility: 'shared' | 'personal', createdByUserId = 'user_a'): Row {
  return { _id: `row_${publicId}`, publicId, name, slug: publicId, visibility, createdByUserId };
}

const shoppingList = list('list_shopping', 'Shopping list', 'shared');
const otherShared = list('list_hardware', 'Hardware', 'shared');
const personalOfB = list('list_b_private', 'Private', 'personal', 'user_b');

const paprikaLists = [
  { uid: 'P1', name: 'My Grocery List', isDefault: true },
  { uid: 'P2', name: 'Party', isDefault: false }
];

function createCtx(lists: Row[] = [shoppingList, otherShared, personalOfB]) {
  const tables: Record<string, Row[]> = { lists: structuredClone(lists), paprikaConnections: [] };
  let nextId = 1;
  const all = () => Object.values(tables).flat();

  const ctx = {
    db: {
      get: async (id: string) => all().find((row) => row._id === id) ?? null,
      insert: async (table: string, row: Record<string, unknown>) => {
        const _id = `${table}_${nextId++}`;
        (tables[table] ??= []).push({ ...row, _id });
        return _id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        const row = all().find((candidate) => candidate._id === id);
        if (row) Object.assign(row, patch);
      },
      delete: async (id: string) => {
        for (const table of Object.keys(tables)) tables[table] = tables[table]!.filter((row) => row._id !== id);
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

  return { ctx: ctx as unknown as Pick<MutationCtx, 'db'>, tables };
}

describe('Paprika connection', () => {
  it('connects with the default Paprika list and the shared Shopping list, and never shows the token', async () => {
    const { ctx } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 'secret-token', groceryLists: paprikaLists });

    const view = await readConnectionViewForUser(ctx, 'user_a');
    expect(view).toEqual({
      status: 'connected',
      groceryLists: [
        { uid: 'P1', name: 'My Grocery List' },
        { uid: 'P2', name: 'Party' }
      ],
      sourceListUid: 'P1',
      targetList: { publicId: 'list_shopping', name: 'Shopping list' }
    });
    expect(JSON.stringify(view)).not.toContain('secret-token');
    expect(await readTokenForUser(ctx, { userId: 'user_a' })).toBe('secret-token');
  });

  it('keeps each person’s connection separate', async () => {
    const { ctx } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 'token-a', groceryLists: paprikaLists });

    expect(await readConnectionViewForUser(ctx, 'user_b')).toBeNull();
    expect(await readTokenForUser(ctx, { userId: 'user_b' })).toBeNull();

    await saveConnectionForUser(ctx, { userId: 'user_b', token: 'token-b', groceryLists: paprikaLists });
    await setSourceListForUser(ctx, { userId: 'user_b', uid: 'P2' });
    await disconnectForUser(ctx, { userId: 'user_b' });

    expect(await readTokenForUser(ctx, { userId: 'user_a' })).toBe('token-a');
    expect((await readConnectionViewForUser(ctx, 'user_a'))?.sourceListUid).toBe('P1');
  });

  it('leaves the target unset when there is no single shared Shopping list', async () => {
    const duplicate = list('list_shopping_2', 'Shopping list', 'shared');
    const { ctx } = createCtx([shoppingList, duplicate]);
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 't', groceryLists: paprikaLists });
    expect((await readConnectionViewForUser(ctx, 'user_a'))?.targetList).toBeNull();
  });

  it('keeps the target by list id through a rename', async () => {
    const { ctx, tables } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 't', groceryLists: paprikaLists });
    await setTargetListForUser(ctx, { userId: 'user_a', publicId: 'list_hardware' });
    tables.lists!.find((row) => row.publicId === 'list_hardware')!.name = 'Tools';

    expect((await readConnectionViewForUser(ctx, 'user_a'))?.targetList).toEqual({
      publicId: 'list_hardware',
      name: 'Tools'
    });
  });

  it('refuses a target list the person cannot see', async () => {
    const { ctx } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 't', groceryLists: paprikaLists });
    await expect(setTargetListForUser(ctx, { userId: 'user_a', publicId: 'list_b_private' })).rejects.toThrow(
      'List unavailable'
    );
  });

  it('shows no target once the target list is deleted', async () => {
    const { ctx, tables } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 't', groceryLists: paprikaLists });
    tables.lists = tables.lists!.filter((row) => row.publicId !== 'list_shopping');
    expect((await readConnectionViewForUser(ctx, 'user_a'))?.targetList).toBeNull();
  });

  it('only accepts a Paprika list Paprika reported', async () => {
    const { ctx } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 't', groceryLists: paprikaLists });
    await expect(setSourceListForUser(ctx, { userId: 'user_a', uid: 'P9' })).rejects.toThrow(
      'Paprika list unavailable'
    );
  });

  it('keeps the choices through a reconnect, falling back when Paprika no longer has the list', async () => {
    const { ctx } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 'old', groceryLists: paprikaLists });
    await setSourceListForUser(ctx, { userId: 'user_a', uid: 'P2' });
    await setTargetListForUser(ctx, { userId: 'user_a', publicId: 'list_hardware' });
    await markNeedsReconnectForUser(ctx, { userId: 'user_a' });
    expect((await readConnectionViewForUser(ctx, 'user_a'))?.status).toBe('needs_reconnect');

    await saveConnectionForUser(ctx, { userId: 'user_a', token: 'new', groceryLists: paprikaLists });
    let view = await readConnectionViewForUser(ctx, 'user_a');
    expect(view).toMatchObject({ status: 'connected', sourceListUid: 'P2', targetList: { publicId: 'list_hardware' } });
    expect(await readTokenForUser(ctx, { userId: 'user_a' })).toBe('new');

    await refreshGroceryListsForUser(ctx, { userId: 'user_a', groceryLists: [paprikaLists[0]!] });
    view = await readConnectionViewForUser(ctx, 'user_a');
    expect(view?.sourceListUid).toBe('P1');
    expect(view?.groceryLists).toEqual([{ uid: 'P1', name: 'My Grocery List' }]);
  });

  it('forgets the token and choices on disconnect', async () => {
    const { ctx, tables } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 't', groceryLists: paprikaLists });
    await disconnectForUser(ctx, { userId: 'user_a' });

    expect(tables.paprikaConnections).toEqual([]);
    expect(await readConnectionViewForUser(ctx, 'user_a')).toBeNull();
  });
});
