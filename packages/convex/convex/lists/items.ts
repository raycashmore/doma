import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

export type ListsQueryCtx = Pick<QueryCtx, 'auth' | 'db'>;
export type ListsMutationCtx = Pick<MutationCtx, 'auth' | 'db'>;
export type ListsReadCtx = ListsQueryCtx | ListsMutationCtx;

export async function requireUserId(ctx: Pick<ListsReadCtx, 'auth'>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity.subject;
}

export function isListVisibleToUser(row: Pick<Doc<'lists'>, 'visibility' | 'createdByUserId'>, currentUserId: string) {
  return row.visibility === 'shared' || row.createdByUserId === currentUserId;
}

export function assertCanEditList(row: Pick<Doc<'lists'>, 'visibility' | 'createdByUserId'>, currentUserId: string) {
  if (row.visibility === 'shared') return;
  if (row.createdByUserId !== currentUserId) throw new Error('List unavailable');
}

function normalizeListItemTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('List item title is required');
  return trimmed;
}

export async function findListByPublicId(ctx: Pick<ListsReadCtx, 'db'>, publicId: string) {
  return ctx.db
    .query('lists')
    .withIndex('by_public_id', (q) => q.eq('publicId', publicId))
    .unique();
}

export async function readListItems(ctx: Pick<ListsReadCtx, 'db'>, listId: Id<'lists'>) {
  return ctx.db
    .query('listItems')
    .withIndex('by_list_id', (q) => q.eq('listId', listId))
    .collect();
}

export async function readListProperties(ctx: Pick<ListsReadCtx, 'db'>, listId: Id<'lists'>) {
  return ctx.db
    .query('listProperties')
    .withIndex('by_list_id', (q) => q.eq('listId', listId))
    .collect();
}

export async function readListItemPropertyValuesByListId(ctx: Pick<ListsReadCtx, 'db'>, listId: Id<'lists'>) {
  return ctx.db
    .query('listItemPropertyValues')
    .withIndex('by_list_id', (q) => q.eq('listId', listId))
    .collect();
}

export async function findListItemById(ctx: Pick<ListsReadCtx, 'db'>, itemId: Id<'listItems'>) {
  const row = await ctx.db.get(itemId);
  return row;
}

export async function findListPropertyById(ctx: Pick<ListsReadCtx, 'db'>, propertyId: Id<'listProperties'>) {
  const row = await ctx.db.get(propertyId);
  return row;
}

export async function findItemPropertyValue(
  ctx: Pick<ListsReadCtx, 'db'>,
  itemId: Id<'listItems'>,
  propertyId: Id<'listProperties'>
) {
  return ctx.db
    .query('listItemPropertyValues')
    .withIndex('by_item_id_and_property_id', (q) => q.eq('listItemId', itemId).eq('listPropertyId', propertyId))
    .unique();
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

export function sortListProperties(properties: Doc<'listProperties'>[]) {
  return [...properties].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export function sortPropertyValues(
  values: Doc<'listItemPropertyValues'>[],
  orderedProperties: Doc<'listProperties'>[]
) {
  const propertyOrder = new Map(orderedProperties.map((property, index) => [property._id, index]));

  return [...values].sort((a, b) => {
    const leftOrder = propertyOrder.get(a.listPropertyId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = propertyOrder.get(b.listPropertyId) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || a.createdAt - b.createdAt;
  });
}

export async function deleteListItemPropertyValuesForItems(
  ctx: Pick<ListsMutationCtx, 'db'>,
  listId: Id<'lists'>,
  itemIds: Id<'listItems'>[]
) {
  if (itemIds.length === 0) return [];

  const propertyValues = await readListItemPropertyValuesByListId(ctx, listId);
  const itemIdSet = new Set(itemIds);
  const matchingPropertyValues = propertyValues.filter((propertyValue) => itemIdSet.has(propertyValue.listItemId));

  for (const propertyValue of matchingPropertyValues) {
    await ctx.db.delete(propertyValue._id);
  }

  return matchingPropertyValues;
}

export async function deleteListSubtree(ctx: Pick<ListsMutationCtx, 'db'>, listId: Id<'lists'>) {
  const listItems = await readListItems(ctx, listId);
  const listProperties = await readListProperties(ctx, listId);
  const listItemPropertyValues = await readListItemPropertyValuesByListId(ctx, listId);

  for (const propertyValue of listItemPropertyValues) {
    await ctx.db.delete(propertyValue._id);
  }

  for (const listItem of listItems) {
    await ctx.db.delete(listItem._id);
  }

  for (const listProperty of listProperties) {
    await ctx.db.delete(listProperty._id);
  }
}

export async function requireVisibleList(ctx: ListsReadCtx, publicId: string) {
  const currentUserId = await requireUserId(ctx);
  const list = await findListByPublicId(ctx, publicId);
  if (!list || !isListVisibleToUser(list, currentUserId)) return null;
  return { currentUserId, list };
}

export async function requireEditableItem(ctx: ListsReadCtx, itemId: Id<'listItems'>) {
  const currentUserId = await requireUserId(ctx);
  const item = await findListItemById(ctx, itemId);
  if (!item) throw new Error('List item unavailable');

  const list = await ctx.db.get(item.listId);
  if (!list || !isListVisibleToUser(list, currentUserId)) throw new Error('List unavailable');
  assertCanEditList(list, currentUserId);

  return { currentUserId, list, item };
}

export async function requireEditableProperty(ctx: ListsReadCtx, propertyId: Id<'listProperties'>) {
  const currentUserId = await requireUserId(ctx);
  const property = await findListPropertyById(ctx, propertyId);
  if (!property) throw new Error('List property unavailable');

  const list = await ctx.db.get(property.listId);
  if (!list || !isListVisibleToUser(list, currentUserId)) throw new Error('List unavailable');
  assertCanEditList(list, currentUserId);

  return { currentUserId, list, property };
}

export async function readVisibleListItemsByPublicId(ctx: ListsQueryCtx, { publicId }: { publicId: string }) {
  const visible = await requireVisibleList(ctx, publicId);
  if (!visible) return null;

  const items = await readListItems(ctx, visible.list._id);
  const properties = sortListProperties(await readListProperties(ctx, visible.list._id));
  const allPropertyValues = await readListItemPropertyValuesByListId(ctx, visible.list._id);
  const propertyValuesByItemId = new Map<Id<'listItems'>, Doc<'listItemPropertyValues'>[]>();

  for (const item of items) {
    propertyValuesByItemId.set(item._id, []);
  }

  for (const propertyValue of sortPropertyValues(allPropertyValues, properties)) {
    const itemPropertyValues = propertyValuesByItemId.get(propertyValue.listItemId);
    if (!itemPropertyValues) continue;
    itemPropertyValues.push(propertyValue);
  }

  return {
    list: visible.list,
    properties,
    activeItems: sortActiveItems(items).map((item) => ({
      ...item,
      propertyValues: propertyValuesByItemId.get(item._id) ?? []
    })),
    completedItems: sortCompletedItems(items).map((item) => ({
      ...item,
      propertyValues: propertyValuesByItemId.get(item._id) ?? []
    }))
  };
}

export async function createListItemHandler(
  ctx: ListsMutationCtx,
  { listPublicId, title }: { listPublicId: string; title: string }
) {
  const [created] = await insertListItems(ctx, listPublicId, [normalizeListItemTitle(title)]);
  return created;
}

export async function createListItemsHandler(
  ctx: ListsMutationCtx,
  { listPublicId, titles }: { listPublicId: string; titles: string[] }
) {
  const normalized = titles.map((title) => title.trim()).filter((title) => title.length > 0);
  return insertListItems(ctx, listPublicId, normalized);
}

async function insertListItems(ctx: ListsMutationCtx, listPublicId: string, titles: string[]) {
  const visible = await requireVisibleList(ctx, listPublicId);
  if (!visible) throw new Error('List unavailable');

  assertCanEditList(visible.list, visible.currentUserId);
  const now = Date.now();
  // Continue past the highest existing active order. Using the active count
  // would collide with existing orders once completed/deleted items leave gaps.
  const activeItems = sortActiveItems(await readListItems(ctx, visible.list._id));
  const baseSortOrder = activeItems.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0);

  const created = [];
  for (const [index, title] of titles.entries()) {
    const row = {
      listId: visible.list._id,
      title,
      sortOrder: baseSortOrder + index,
      createdAt: now,
      updatedAt: now
    };
    const id = await ctx.db.insert('listItems', row);
    created.push({ _id: id, ...row });
  }

  return created;
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

export async function setListItemNotesHandler(
  ctx: ListsMutationCtx,
  { itemId, notes }: { itemId: Id<'listItems'>; notes: string }
) {
  const { item } = await requireEditableItem(ctx, itemId);
  const trimmed = notes.trim();
  const patch = {
    notes: trimmed ? trimmed : undefined,
    updatedAt: Date.now()
  };

  await ctx.db.patch(item._id, patch);
  return { ...item, ...patch };
}

export async function deleteListItemHandler(ctx: ListsMutationCtx, { itemId }: { itemId: Id<'listItems'> }) {
  const { list, item } = await requireEditableItem(ctx, itemId);
  await deleteListItemPropertyValuesForItems(ctx, list._id, [item._id]);
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
  await deleteListItemPropertyValuesForItems(
    ctx,
    visible.list._id,
    completedItems.map((item) => item._id)
  );

  for (const item of completedItems) {
    await ctx.db.delete(item._id);
  }

  return {
    removedItemIds: completedItems.map((item) => item._id)
  };
}
