import type { Doc, Id } from '../_generated/dataModel';
import {
  assertCanEditList,
  findListByPublicId,
  isListVisibleToUser,
  type ListsMutationCtx,
  type ListsReadCtx,
  readListItems
} from './items';
import { nextActiveSortOrder } from './transitions';

type BotReadCtx = ListsReadCtx;
type BotWriteCtx = ListsMutationCtx;

export type ListsBotReadCtx = BotReadCtx;
export type ListsBotMutationCtx = BotWriteCtx;

export type DefaultListSummary = { publicId: string; name: string };

export type AddressableListSummary = { id: string; name: string };

/**
 * The lists a household user can have the bot target: their own personal lists
 * plus every shared list. Returned by list publicId (stable across renames) so
 * the parser resolves to an id, not the message's wording.
 */
export async function readAddressableListsForUser(
  ctx: BotReadCtx,
  { currentUserId }: { currentUserId: string }
): Promise<AddressableListSummary[]> {
  const lists = await ctx.db.query('lists').collect();
  return lists
    .filter((list) => isListVisibleToUser(list, currentUserId))
    .map((list) => ({ id: list.publicId, name: list.name }));
}

async function findDefaultRow(ctx: BotReadCtx, currentUserId: string) {
  return ctx.db
    .query('listDefaults')
    .withIndex('by_user', (q) => q.eq('userId', currentUserId))
    .unique();
}

/**
 * Resolve the household user's default list to its current publicId and name.
 * The default is stored by list id, so this survives renames; it returns null
 * when no default is set or the target list is no longer visible to the user.
 */
export async function readDefaultListForUser(
  ctx: BotReadCtx,
  { currentUserId }: { currentUserId: string }
): Promise<DefaultListSummary | null> {
  const row = await findDefaultRow(ctx, currentUserId);
  if (!row) return null;

  const list = await ctx.db.get(row.listId);
  if (!list || !isListVisibleToUser(list, currentUserId)) return null;

  return { publicId: list.publicId, name: list.name };
}

export async function setDefaultListForUser(
  ctx: BotWriteCtx,
  { currentUserId, publicId }: { currentUserId: string; publicId: string }
): Promise<DefaultListSummary> {
  const list = await findListByPublicId(ctx, publicId);
  if (!list || !isListVisibleToUser(list, currentUserId)) throw new Error('List unavailable');

  const now = Date.now();
  const existing = await findDefaultRow(ctx, currentUserId);
  if (existing) {
    await ctx.db.patch(existing._id, { listId: list._id, updatedAt: now });
  } else {
    await ctx.db.insert('listDefaults', {
      userId: currentUserId,
      listId: list._id,
      createdAt: now,
      updatedAt: now
    });
  }

  return { publicId: list.publicId, name: list.name };
}

export type CreatedBotListItem = { _id: Id<'listItems'>; title: string };

/**
 * Create title-only list items in a list the given user can edit, acting as
 * that linked user rather than relying on ctx.auth. Mirrors the in-app
 * insertion order (one past the highest active order).
 */
export async function createListItemsForUser(
  ctx: BotWriteCtx,
  { currentUserId, listPublicId, titles }: { currentUserId: string; listPublicId: string; titles: string[] }
): Promise<{ list: DefaultListSummary; items: CreatedBotListItem[] }> {
  const list = await findListByPublicId(ctx, listPublicId);
  if (!list || !isListVisibleToUser(list, currentUserId)) throw new Error('List unavailable');
  assertCanEditList(list, currentUserId);

  const cleaned = titles.map((title) => title.trim()).filter((title) => title.length > 0);
  const now = Date.now();
  const activeItems = (await readListItems(ctx, list._id))
    .filter((item: Doc<'listItems'>) => item.completedAt === undefined)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  const baseSortOrder = nextActiveSortOrder(activeItems);

  const items: CreatedBotListItem[] = [];
  for (const [index, title] of cleaned.entries()) {
    const _id = (await ctx.db.insert('listItems', {
      listId: list._id,
      title,
      sortOrder: baseSortOrder + index,
      createdAt: now,
      updatedAt: now
    })) as Id<'listItems'>;
    items.push({ _id, title });
  }

  return { list: { publicId: list.publicId, name: list.name }, items };
}
