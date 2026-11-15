import { v } from 'convex/values';

import type { Doc } from '../_generated/dataModel';
import { mutation, type MutationCtx, query, type QueryCtx } from '../_generated/server';
import { findListByPublicId, findSharedShoppingList, isListVisibleToUser, requireUserId } from './items';

type ReadCtx = Pick<QueryCtx, 'db'>;

/**
 * The person's Groceries list: where recipe ingredients and Paprika items go.
 * Their chosen list while it still exists and is visible to them; otherwise the
 * one shared list named "Shopping list"; otherwise null.
 */
export async function readGroceriesListForUser(ctx: ReadCtx, userId: string): Promise<Doc<'lists'> | null> {
  const row = await ctx.db
    .query('groceriesListDefaults')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  const chosen = row ? await ctx.db.get(row.listId) : null;
  if (chosen && isListVisibleToUser(chosen, userId)) return chosen;
  return findSharedShoppingList(ctx);
}

export async function setGroceriesListForUser(
  ctx: Pick<MutationCtx, 'db'>,
  { userId, publicId }: { userId: string; publicId: string }
) {
  const list = await findListByPublicId(ctx, publicId);
  if (!list || !isListVisibleToUser(list, userId)) throw new Error('List unavailable');

  const now = Date.now();
  const existing = await ctx.db
    .query('groceriesListDefaults')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { listId: list._id, updatedAt: now });
  } else {
    await ctx.db.insert('groceriesListDefaults', { userId, listId: list._id, createdAt: now, updatedAt: now });
  }
}

/** The signed-in person's Groceries list, or null when none is chosen and no single "Shopping list" exists. */
export const getGroceriesList = query({
  args: {},
  handler: async (ctx) => {
    const list = await readGroceriesListForUser(ctx, await requireUserId(ctx));
    return list ? { publicId: list.publicId, name: list.name } : null;
  }
});

export const setGroceriesList = mutation({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => setGroceriesListForUser(ctx, { userId: await requireUserId(ctx), publicId })
});
