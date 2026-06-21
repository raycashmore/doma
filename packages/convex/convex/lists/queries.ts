import { v } from 'convex/values';

import { query, type QueryCtx } from '../_generated/server';
import { readVisibleListItemsByPublicId } from './items';

export function filterVisibleLists<T extends { visibility: 'personal' | 'shared'; createdByUserId: string }>(
  rows: T[],
  currentUserId: string
): T[] {
  return rows.filter((row) => row.visibility === 'shared' || row.createdByUserId === currentUserId);
}

export function pickVisibleListByPublicId<
  T extends { publicId: string; visibility: 'personal' | 'shared'; createdByUserId: string }
>(rows: T[], publicId: string, currentUserId: string): T | null {
  return filterVisibleLists(rows, currentUserId).find((row) => row.publicId === publicId) ?? null;
}

async function requireUserId(ctx: Pick<QueryCtx, 'auth'>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity.subject;
}

export async function readVisibleLists(ctx: Pick<QueryCtx, 'auth' | 'db'>) {
  const currentUserId = await requireUserId(ctx);
  const rows = await ctx.db.query('lists').collect();

  return filterVisibleLists(rows, currentUserId);
}

export async function readVisibleListByPublicId(
  ctx: Pick<QueryCtx, 'auth' | 'db'>,
  { publicId }: { publicId: string }
) {
  const currentUserId = await requireUserId(ctx);
  const row = await ctx.db
    .query('lists')
    .withIndex('by_public_id', (q) => q.eq('publicId', publicId))
    .unique();

  if (!row) return null;
  return pickVisibleListByPublicId([row], publicId, currentUserId);
}

export const listVisibleToMe = query({
  args: {},
  handler: readVisibleLists
});

export const getVisibleListByPublicId = query({
  args: { publicId: v.string() },
  handler: readVisibleListByPublicId
});

export const getVisibleListItemsByPublicId = query({
  args: { publicId: v.string() },
  handler: readVisibleListItemsByPublicId
});

/**
 * Read the signed-in user's default list, or null when none is set.
 * Stored by list id, so it survives renames; returns null if the target list
 * was deleted or is no longer visible to the user.
 */
export const getDefaultList = query({
  args: {},
  handler: async (ctx) => {
    const currentUserId = await requireUserId(ctx);
    const row = await ctx.db
      .query('listDefaults')
      .withIndex('by_user', (q) => q.eq('userId', currentUserId))
      .unique();
    if (!row) return null;

    const list = await ctx.db.get(row.listId);
    if (!list) return null;

    const visibleLists = filterVisibleLists([list], currentUserId);
    if (!visibleLists.length) return null;

    return { publicId: list.publicId, name: list.name };
  }
});
