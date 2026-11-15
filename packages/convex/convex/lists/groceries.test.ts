import { describe, expect, it } from 'vitest';

import type { MutationCtx } from '../_generated/server';
import { readGroceriesListForUser, setGroceriesListForUser } from './groceries';
import { createFakeDb, type FakeRow } from './testHelpers';

function list(publicId: string, name: string, visibility: 'shared' | 'personal', createdByUserId = 'user_a'): FakeRow {
  return { _id: `row_${publicId}`, publicId, name, slug: publicId, visibility, createdByUserId };
}

const shoppingList = list('list_shopping', 'Shopping list', 'shared');
const weekly = list('list_weekly', 'Weekly shop', 'shared');
const privateOfB = list('list_b_private', 'Private', 'personal', 'user_b');

function createCtx(lists: FakeRow[] = [shoppingList, weekly, privateOfB]) {
  const { db, tables } = createFakeDb({ lists, groceriesListDefaults: [] });
  return { ctx: { db } as unknown as Pick<MutationCtx, 'db'>, tables };
}

async function groceriesName(ctx: Pick<MutationCtx, 'db'>, userId: string) {
  return (await readGroceriesListForUser(ctx, userId))?.name ?? null;
}

describe('Groceries list', () => {
  it('falls back to the one shared "Shopping list" until the person chooses one', async () => {
    const { ctx } = createCtx();
    expect(await groceriesName(ctx, 'user_a')).toBe('Shopping list');

    await setGroceriesListForUser(ctx, { userId: 'user_a', publicId: 'list_weekly' });
    expect(await groceriesName(ctx, 'user_a')).toBe('Weekly shop');
  });

  it('is chosen per person', async () => {
    const { ctx } = createCtx();
    await setGroceriesListForUser(ctx, { userId: 'user_a', publicId: 'list_weekly' });
    expect(await groceriesName(ctx, 'user_b')).toBe('Shopping list');
  });

  it('follows the chosen list through a rename, and falls back once it is deleted', async () => {
    const { ctx, tables } = createCtx();
    await setGroceriesListForUser(ctx, { userId: 'user_a', publicId: 'list_weekly' });

    tables.lists!.find((row) => row.publicId === 'list_weekly')!.name = 'Big shop';
    expect(await groceriesName(ctx, 'user_a')).toBe('Big shop');

    tables.lists = tables.lists!.filter((row) => row.publicId !== 'list_weekly');
    expect(await groceriesName(ctx, 'user_a')).toBe('Shopping list');
  });

  it('has none when nothing is chosen and there is no single "Shopping list"', async () => {
    const { ctx } = createCtx([weekly, shoppingList, { ...shoppingList, _id: 'row_dup', publicId: 'list_dup' }]);
    expect(await groceriesName(ctx, 'user_a')).toBeNull();
  });

  it('refuses a list the person cannot see', async () => {
    const { ctx } = createCtx();
    await expect(setGroceriesListForUser(ctx, { userId: 'user_a', publicId: 'list_b_private' })).rejects.toThrow(
      'List unavailable'
    );
  });
});
