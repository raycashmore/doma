import type { Doc, Id } from '../_generated/dataModel';
import { findListByPublicId, isListVisibleToUser, type ListsMutationCtx, type ListsReadCtx } from './items';
import { reorderByIndex } from './transitions';

/**
 * Put lists in one person's order: lists they have placed come first by their
 * sort order, then the rest in the order given (creation order), so a new list
 * lands at the end and untouched lists keep creation order. Sorting the whole
 * set keeps each tab's relative order, because a list never changes tab.
 */
export function orderListsForUser<T extends { _id: string }>(
  lists: readonly T[],
  preferences: readonly { listId: string; sortOrder: number }[]
): T[] {
  const sortOrderByListId = new Map(preferences.map((preference) => [preference.listId, preference.sortOrder]));
  const rank = (list: T) => sortOrderByListId.get(list._id) ?? Number.POSITIVE_INFINITY;
  return [...lists].sort((a, b) => {
    const left = rank(a);
    const right = rank(b);
    return left === right ? 0 : left < right ? -1 : 1;
  });
}

export async function readListOrderPreferences(ctx: Pick<ListsReadCtx, 'db'>, currentUserId: string) {
  return ctx.db
    .query('listOrderPreferences')
    .withIndex('by_user_and_list', (q) => q.eq('userId', currentUserId))
    .collect();
}

/**
 * Move one list to `targetIndex` within its tab, for the current person only.
 * Every list in the tab gets a dense position, so later new lists still land
 * at the end. The index is clamped to the server's tab, which can differ from
 * the caller's view when someone else has just added a shared list.
 */
export async function reorderListForUser(
  ctx: ListsMutationCtx,
  { currentUserId, publicId, targetIndex }: { currentUserId: string; publicId: string; targetIndex: number }
) {
  const moved = await findListByPublicId(ctx, publicId);
  if (!moved || !isListVisibleToUser(moved, currentUserId)) throw new Error('List unavailable');

  const tabLists = (
    await ctx.db
      .query('lists')
      .withIndex('by_visibility', (q) => q.eq('visibility', moved.visibility))
      .collect()
  ).filter((list) => isListVisibleToUser(list, currentUserId));

  const preferences = await readListOrderPreferences(ctx, currentUserId);
  const current = orderListsForUser(tabLists, preferences).map((list, index) => ({ _id: list._id, sortOrder: index }));
  const desired = reorderByIndex(current, moved._id, targetIndex);

  const preferenceByListId = new Map<Id<'lists'>, Doc<'listOrderPreferences'>>(
    preferences.map((preference) => [preference.listId, preference])
  );
  const now = Date.now();
  for (const { _id: listId, sortOrder } of desired) {
    const existing = preferenceByListId.get(listId);
    if (existing?.sortOrder === sortOrder) continue;
    if (existing) {
      await ctx.db.patch(existing._id, { sortOrder, updatedAt: now });
    } else {
      await ctx.db.insert('listOrderPreferences', {
        userId: currentUserId,
        listId,
        sortOrder,
        createdAt: now,
        updatedAt: now
      });
    }
  }
}
