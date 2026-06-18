import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type ListsQueryCtx = Pick<QueryCtx, 'auth' | 'db'>;
type ListsMutationCtx = Pick<MutationCtx, 'auth' | 'db'>;
type ListsReadCtx = ListsQueryCtx | ListsMutationCtx;

async function requireUserId(ctx: Pick<ListsReadCtx, 'auth'>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity.subject;
}

function isListVisibleToUser(row: Pick<Doc<'lists'>, 'visibility' | 'createdByUserId'>, currentUserId: string) {
  return row.visibility === 'shared' || row.createdByUserId === currentUserId;
}

function assertCanEditList(row: Pick<Doc<'lists'>, 'visibility' | 'createdByUserId'>, currentUserId: string) {
  if (row.visibility === 'shared') return;
  if (row.createdByUserId !== currentUserId) throw new Error('List unavailable');
}

function normalizeListItemTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('List item title is required');
  return trimmed;
}

async function findListByPublicId(ctx: Pick<ListsReadCtx, 'db'>, publicId: string) {
  return ctx.db
    .query('lists')
    .withIndex('by_public_id', (q) => q.eq('publicId', publicId))
    .unique();
}

async function readListItems(ctx: Pick<ListsReadCtx, 'db'>, listId: Id<'lists'>) {
  return ctx.db
    .query('listItems')
    .withIndex('by_list_id', (q) => q.eq('listId', listId))
    .collect();
}

async function findListItemById(ctx: Pick<ListsReadCtx, 'db'>, itemId: Id<'listItems'>) {
  const row = await ctx.db.get(itemId);
  return row;
}

function sortActiveItems(items: Doc<'listItems'>[]) {
  return [...items]
    .filter((item) => item.completedAt === undefined)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

function sortCompletedItems(items: Doc<'listItems'>[]) {
  return [...items]
    .filter((item) => item.completedAt !== undefined)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0) || b.updatedAt - a.updatedAt);
}

async function requireVisibleList(ctx: ListsReadCtx, publicId: string) {
  const currentUserId = await requireUserId(ctx);
  const list = await findListByPublicId(ctx, publicId);
  if (!list || !isListVisibleToUser(list, currentUserId)) return null;
  return { currentUserId, list };
}

async function requireEditableItem(ctx: ListsReadCtx, itemId: Id<'listItems'>) {
  const currentUserId = await requireUserId(ctx);
  const item = await findListItemById(ctx, itemId);
  if (!item) throw new Error('List item unavailable');

  const list = await ctx.db.get(item.listId);
  if (!list || !isListVisibleToUser(list, currentUserId)) throw new Error('List unavailable');
  assertCanEditList(list, currentUserId);

  return { currentUserId, list, item };
}

export async function readVisibleListItemsByPublicId(ctx: ListsQueryCtx, { publicId }: { publicId: string }) {
  const visible = await requireVisibleList(ctx, publicId);
  if (!visible) return null;

  const items = await readListItems(ctx, visible.list._id);

  return {
    list: visible.list,
    activeItems: sortActiveItems(items),
    completedItems: sortCompletedItems(items)
  };
}

export async function createListItemHandler(
  ctx: ListsMutationCtx,
  { listPublicId, title }: { listPublicId: string; title: string }
) {
  const visible = await requireVisibleList(ctx, listPublicId);
  if (!visible) throw new Error('List unavailable');

  assertCanEditList(visible.list, visible.currentUserId);
  const normalizedTitle = normalizeListItemTitle(title);
  const now = Date.now();
  const activeItems = sortActiveItems(await readListItems(ctx, visible.list._id));
  const row = {
    listId: visible.list._id,
    title: normalizedTitle,
    sortOrder: activeItems.length,
    createdAt: now,
    updatedAt: now
  };

  const id = await ctx.db.insert('listItems', row);
  return { _id: id, ...row };
}

export async function renameListItemHandler(
  ctx: ListsMutationCtx,
  { itemId, title }: { itemId: Id<'listItems'>; title: string }
) {
  const { item } = await requireEditableItem(ctx, itemId);
  const patch = {
    title: normalizeListItemTitle(title),
    updatedAt: Date.now()
  };

  await ctx.db.patch(item._id, patch);
  return { ...item, ...patch };
}

export async function deleteListItemHandler(ctx: ListsMutationCtx, { itemId }: { itemId: Id<'listItems'> }) {
  await requireEditableItem(ctx, itemId);
  await ctx.db.delete(itemId);
  return { itemId };
}

export async function completeListItemHandler(ctx: ListsMutationCtx, { itemId }: { itemId: Id<'listItems'> }) {
  const { item } = await requireEditableItem(ctx, itemId);
  const now = Date.now();
  const patch = {
    completedAt: now,
    updatedAt: now
  };

  await ctx.db.patch(item._id, patch);
  return { ...item, ...patch };
}

export async function uncompleteListItemHandler(ctx: ListsMutationCtx, { itemId }: { itemId: Id<'listItems'> }) {
  const { list, item } = await requireEditableItem(ctx, itemId);
  const now = Date.now();
  const activeItems = sortActiveItems(await readListItems(ctx, list._id));
  const patch = {
    completedAt: undefined,
    sortOrder: activeItems.length,
    updatedAt: now
  };

  await ctx.db.patch(item._id, patch);
  return { ...item, ...patch };
}

export async function reorderListItemHandler(
  ctx: ListsMutationCtx,
  { itemId, targetIndex }: { itemId: Id<'listItems'>; targetIndex: number }
) {
  const { list, item } = await requireEditableItem(ctx, itemId);
  if (item.completedAt !== undefined) throw new Error('Completed items cannot be reordered');

  const now = Date.now();
  const activeItems = sortActiveItems(await readListItems(ctx, list._id));
  const currentIndex = activeItems.findIndex((candidate) => candidate._id === itemId);
  if (currentIndex === -1) throw new Error('List item unavailable');

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, activeItems.length - 1));
  if (boundedTargetIndex === currentIndex) return activeItems;

  const reordered = [...activeItems];
  const [movedItem] = reordered.splice(currentIndex, 1);
  if (!movedItem) throw new Error('List item unavailable');
  reordered.splice(boundedTargetIndex, 0, movedItem);

  for (const [index, activeItem] of reordered.entries()) {
    if (activeItem.sortOrder === index) continue;
    await ctx.db.patch(activeItem._id, {
      sortOrder: index,
      updatedAt: now
    });
  }

  return reordered.map((activeItem, index) => ({
    ...activeItem,
    sortOrder: index,
    updatedAt: activeItem.sortOrder === index ? activeItem.updatedAt : now
  }));
}

export async function clearCompletedListItemsHandler(
  ctx: ListsMutationCtx,
  { listPublicId }: { listPublicId: string }
) {
  const visible = await requireVisibleList(ctx, listPublicId);
  if (!visible) throw new Error('List unavailable');

  assertCanEditList(visible.list, visible.currentUserId);
  const completedItems = sortCompletedItems(await readListItems(ctx, visible.list._id));

  for (const item of completedItems) {
    await ctx.db.delete(item._id);
  }

  return {
    removedItemIds: completedItems.map((item) => item._id)
  };
}
