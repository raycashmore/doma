import type { Id } from '../_generated/dataModel';
import { findListByPublicId, isListVisibleToUser, type ListsMutationCtx, type ListsReadCtx } from './items';

async function findPreference(
  ctx: Pick<ListsReadCtx, 'db'>,
  { currentUserId, listId }: { currentUserId: string; listId: Id<'lists'> }
) {
  return ctx.db
    .query('listGroupingPreferences')
    .withIndex('by_user_and_list', (q) => q.eq('userId', currentUserId).eq('listId', listId))
    .unique();
}

/**
 * Read one household user's selected grouping for a visible list. A stale
 * property reference is treated as manual order, so removing a shared list
 * property cannot leave anyone with an unusable grouping selection.
 */
export async function readActiveGroupingPropertyForUser(
  ctx: ListsReadCtx,
  { currentUserId, listPublicId }: { currentUserId: string; listPublicId: string }
): Promise<Id<'listProperties'> | null> {
  const list = await findListByPublicId(ctx, listPublicId);
  if (!list || !isListVisibleToUser(list, currentUserId)) return null;

  const preference = await findPreference(ctx, { currentUserId, listId: list._id });
  if (!preference) return null;

  const property = await ctx.db.get(preference.propertyId);
  return property?.listId === list._id ? property._id : null;
}

/**
 * Store the active grouping only for the current household user. Clearing the
 * selection deletes the row, keeping manual order as the natural default.
 */
export async function setActiveGroupingPropertyForUser(
  ctx: ListsMutationCtx,
  {
    currentUserId,
    listPublicId,
    propertyId
  }: { currentUserId: string; listPublicId: string; propertyId: Id<'listProperties'> | null }
): Promise<Id<'listProperties'> | null> {
  const list = await findListByPublicId(ctx, listPublicId);
  if (!list || !isListVisibleToUser(list, currentUserId)) throw new Error('List unavailable');

  const existing = await findPreference(ctx, { currentUserId, listId: list._id });
  if (!propertyId) {
    if (existing) await ctx.db.delete(existing._id);
    return null;
  }

  const property = await ctx.db.get(propertyId);
  if (!property || property.listId !== list._id) throw new Error('List property unavailable');

  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { propertyId, updatedAt: now });
  } else {
    await ctx.db.insert('listGroupingPreferences', {
      userId: currentUserId,
      listId: list._id,
      propertyId,
      createdAt: now,
      updatedAt: now
    });
  }

  return propertyId;
}
