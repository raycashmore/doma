import { describe, expect, it } from 'vitest';

import type { MutationCtx } from '../_generated/server';
import { setGroceriesListForUser } from '../lists/groceries';
import { createFakeDb, type FakeRow } from '../lists/testHelpers';
import {
  disconnectForUser,
  markNeedsReconnectForUser,
  readConnectionViewForUser,
  readTokenForUser,
  refreshGroceryListsForUser,
  saveConnectionForUser,
  setSourceListForUser
} from './model';

type Row = FakeRow;

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
  const { db, tables } = createFakeDb({ lists, paprikaConnections: [], groceriesListDefaults: [] });
  return { ctx: { db } as unknown as Pick<MutationCtx, 'db'>, tables };
}

describe('Paprika connection', () => {
  it('connects with the default Paprika list, shows the Groceries list, and never shows the token', async () => {
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
      groceriesList: { publicId: 'list_shopping', name: 'Shopping list' }
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

  it('shows the person’s chosen Groceries list as where items go', async () => {
    const { ctx } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 't', groceryLists: paprikaLists });
    await setGroceriesListForUser(ctx, { userId: 'user_a', publicId: 'list_hardware' });

    expect((await readConnectionViewForUser(ctx, 'user_a'))?.groceriesList).toEqual({
      publicId: 'list_hardware',
      name: 'Hardware'
    });
  });

  it('only accepts a Paprika list Paprika reported', async () => {
    const { ctx } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 't', groceryLists: paprikaLists });
    await expect(setSourceListForUser(ctx, { userId: 'user_a', uid: 'P9' })).rejects.toThrow(
      'Paprika list unavailable'
    );
  });

  it('keeps the Paprika list through a reconnect, falling back when Paprika no longer has it', async () => {
    const { ctx } = createCtx();
    await saveConnectionForUser(ctx, { userId: 'user_a', token: 'old', groceryLists: paprikaLists });
    await setSourceListForUser(ctx, { userId: 'user_a', uid: 'P2' });
    await markNeedsReconnectForUser(ctx, { userId: 'user_a' });
    expect((await readConnectionViewForUser(ctx, 'user_a'))?.status).toBe('needs_reconnect');

    await saveConnectionForUser(ctx, { userId: 'user_a', token: 'new', groceryLists: paprikaLists });
    let view = await readConnectionViewForUser(ctx, 'user_a');
    expect(view).toMatchObject({ status: 'connected', sourceListUid: 'P2' });
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
