import { describe, expect, it } from 'vitest';

import type { MutationCtx } from '../_generated/server';
import { createFakeDb, type FakeRow } from '../lists/testHelpers';
import { readImportContextForUser, recordImportForUser } from './imports';
import { selectImportableItems } from './importSelection';

function list(publicId: string, name: string, visibility: 'shared' | 'personal', createdByUserId = 'user_a'): FakeRow {
  return { _id: `row_${publicId}`, publicId, name, slug: publicId, visibility, createdByUserId };
}

const shoppingList = list('list_shopping', 'Shopping list', 'shared');

function createCtx({ lists = [shoppingList], items = [] as FakeRow[], imported = [] as FakeRow[] } = {}) {
  const { db, tables } = createFakeDb({
    lists,
    listItems: items,
    paprikaImportedItems: imported,
    paprikaConnections: [{ _id: 'conn_a', userId: 'user_a', sourceListUid: 'P1' }],
    groceriesListDefaults: []
  });
  const scheduled: unknown[] = [];
  const scheduler = {
    runAfter: async (_delay: number, _ref: unknown, args: unknown) => {
      scheduled.push(args);
    }
  };
  return { ctx: { db, scheduler } as unknown as Pick<MutationCtx, 'db' | 'scheduler'>, tables, scheduled };
}

const spinach = { uid: 'G1', title: '100g frozen spinach', recipe: 'Spinach pie' };
const milk = { uid: 'G2', title: 'Milk', recipe: null };

describe('recordImportForUser', () => {
  it('adds the items to the Groceries list with the Paprika marker and the recipe in notes', async () => {
    const { ctx, tables } = createCtx({
      items: [{ _id: 'existing', listId: shoppingList._id, title: 'Bread', sortOrder: 4, createdAt: 1, updatedAt: 1 }]
    });

    const result = await recordImportForUser(ctx, { userId: 'user_a', items: [spinach, milk] });

    expect(result).toEqual({ status: 'imported', importedUids: ['G1', 'G2'], listName: 'Shopping list' });
    const added = tables.listItems!.filter((item) => item.source === 'paprika');
    expect(added.map(({ title, notes, sortOrder }) => ({ title, notes, sortOrder }))).toEqual([
      { title: '100g frozen spinach', notes: 'From Spinach pie', sortOrder: 5 },
      { title: 'Milk', notes: undefined, sortOrder: 6 }
    ]);
  });

  it('never imports an item twice, even after the Doma item is gone', async () => {
    const { ctx, tables } = createCtx();
    await recordImportForUser(ctx, { userId: 'user_a', items: [spinach] });
    tables.listItems = [];

    const again = await recordImportForUser(ctx, { userId: 'user_a', items: [spinach, spinach, milk] });

    expect(again).toEqual({ status: 'imported', importedUids: ['G2'], listName: 'Shopping list' });
    expect(tables.listItems!.map((item) => item.title)).toEqual(['Milk']);
  });

  it('schedules one categorisation and one widget refresh per import, and none when nothing is new', async () => {
    const { ctx, scheduled } = createCtx();
    await recordImportForUser(ctx, { userId: 'user_a', items: [spinach, milk] });
    expect(scheduled).toHaveLength(2);

    await recordImportForUser(ctx, { userId: 'user_a', items: [spinach, milk] });
    expect(scheduled).toHaveLength(2);
  });

  it('adds and remembers nothing when the person has no Groceries list', async () => {
    const { ctx, tables } = createCtx({ lists: [] });
    expect(await recordImportForUser(ctx, { userId: 'user_a', items: [spinach] })).toEqual({
      status: 'no_groceries_list'
    });
    expect(tables.paprikaImportedItems).toEqual([]);
  });

  it('keeps each person’s imports apart', async () => {
    const { ctx } = createCtx();
    await recordImportForUser(ctx, { userId: 'user_a', items: [spinach] });
    expect(await readImportContextForUser(ctx, { userId: 'user_a', uids: ['G1', 'G2'] })).toEqual({
      sourceListUid: 'P1',
      importedUids: ['G1'],
      hasGroceriesList: true
    });
    expect(await readImportContextForUser(ctx, { userId: 'user_b', uids: ['G1'] })).toEqual({
      sourceListUid: null,
      importedUids: [],
      hasGroceriesList: true
    });
  });
});

describe('selectImportableItems', () => {
  it('keeps only items on the chosen Paprika list that are still to buy and not imported', () => {
    const item = (uid: string, listUid: string, purchased = false) => ({
      uid,
      listUid,
      name: uid,
      recipe: null,
      purchased,
      raw: {}
    });
    const items = [item('A', 'P1'), item('B', 'P2'), item('C', 'P1', true), item('D', 'P1')];
    expect(
      selectImportableItems(items, { sourceListUid: 'P1', importedUids: ['D'] }).map((candidate) => candidate.uid)
    ).toEqual(['A']);
  });
});
