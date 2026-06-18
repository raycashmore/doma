import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type ListsQueryCtx = Pick<QueryCtx, 'auth' | 'db'>;
type ListsMutationCtx = Pick<MutationCtx, 'auth' | 'db'>;
type ListsReadCtx = ListsQueryCtx | ListsMutationCtx;
type ListPropertyType = 'text' | 'number' | 'date' | 'select' | 'checkbox';
type ListPropertyOption = { id: string; label: string };
type SetListItemPropertyValue =
  | { type: 'text'; text: string }
  | { type: 'number'; number: number }
  | { type: 'date'; date: number }
  | { type: 'select'; optionId: string }
  | { type: 'checkbox'; checked: boolean };

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

function normalizeListPropertyName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('List property name is required');
  return trimmed;
}

function normalizeListPropertyOptions(type: ListPropertyType, options?: ListPropertyOption[]) {
  if (type !== 'select') return undefined;
  return options && options.length > 0 ? options : undefined;
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

async function readListProperties(ctx: Pick<ListsReadCtx, 'db'>, listId: Id<'lists'>) {
  return ctx.db
    .query('listProperties')
    .withIndex('by_list_id', (q) => q.eq('listId', listId))
    .collect();
}

async function readListItemPropertyValues(ctx: Pick<ListsReadCtx, 'db'>, itemId: Id<'listItems'>) {
  return ctx.db
    .query('listItemPropertyValues')
    .withIndex('by_item_id', (q) => q.eq('listItemId', itemId))
    .collect();
}

async function findListItemById(ctx: Pick<ListsReadCtx, 'db'>, itemId: Id<'listItems'>) {
  const row = await ctx.db.get(itemId);
  return row;
}

async function findListPropertyById(ctx: Pick<ListsReadCtx, 'db'>, propertyId: Id<'listProperties'>) {
  const row = await ctx.db.get(propertyId);
  return row;
}

async function findItemPropertyValue(
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

function sortListProperties(properties: Doc<'listProperties'>[]) {
  return [...properties].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

function sortPropertyValues(values: Doc<'listItemPropertyValues'>[], orderedProperties: Doc<'listProperties'>[]) {
  const propertyOrder = new Map(orderedProperties.map((property, index) => [property._id, index]));

  return [...values].sort((a, b) => {
    const leftOrder = propertyOrder.get(a.listPropertyId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = propertyOrder.get(b.listPropertyId) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || a.createdAt - b.createdAt;
  });
}

function buildPropertyValuePatch(property: Doc<'listProperties'>, value: SetListItemPropertyValue) {
  if (property.type !== value.type) throw new Error('List property value is invalid');

  switch (value.type) {
    case 'text':
      return { textValue: value.text };
    case 'number':
      return { numberValue: value.number };
    case 'date':
      return { dateValue: value.date };
    case 'checkbox':
      return { checkboxValue: value.checked };
    case 'select': {
      const optionIsValid = property.options?.some((option) => option.id === value.optionId) ?? false;
      if (!optionIsValid) throw new Error('List property option is invalid');
      return { selectOptionId: value.optionId };
    }
  }
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

async function requireEditableProperty(ctx: ListsReadCtx, propertyId: Id<'listProperties'>) {
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
  const propertyValuesByItemId = new Map(
    (
      await Promise.all(
        items.map(
          async (item) =>
            [item._id, sortPropertyValues(await readListItemPropertyValues(ctx, item._id), properties)] as const
        )
      )
    ).map(([itemId, propertyValues]) => [itemId, propertyValues])
  );

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

export async function createListPropertyHandler(
  ctx: ListsMutationCtx,
  args: { listPublicId: string; name: string; type: ListPropertyType; options?: ListPropertyOption[] }
) {
  const visible = await requireVisibleList(ctx, args.listPublicId);
  if (!visible) throw new Error('List unavailable');

  assertCanEditList(visible.list, visible.currentUserId);
  const now = Date.now();
  const orderedProperties = sortListProperties(await readListProperties(ctx, visible.list._id));
  const row = {
    listId: visible.list._id,
    name: normalizeListPropertyName(args.name),
    type: args.type,
    sortOrder: orderedProperties.length,
    options: normalizeListPropertyOptions(args.type, args.options),
    createdAt: now,
    updatedAt: now
  };

  const id = await ctx.db.insert('listProperties', row);
  return { _id: id, ...row };
}

export async function reorderListPropertyHandler(
  ctx: ListsMutationCtx,
  { propertyId, targetIndex }: { propertyId: Id<'listProperties'>; targetIndex: number }
) {
  const { list, property } = await requireEditableProperty(ctx, propertyId);
  const orderedProperties = sortListProperties(await readListProperties(ctx, list._id));
  const currentIndex = orderedProperties.findIndex((candidate) => candidate._id === property._id);
  if (currentIndex === -1) throw new Error('List property unavailable');

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, orderedProperties.length - 1));
  if (boundedTargetIndex === currentIndex) return orderedProperties;

  const reordered = [...orderedProperties];
  const [movedProperty] = reordered.splice(currentIndex, 1);
  if (!movedProperty) throw new Error('List property unavailable');
  reordered.splice(boundedTargetIndex, 0, movedProperty);

  const now = Date.now();

  for (const [index, listProperty] of reordered.entries()) {
    if (listProperty.sortOrder === index) continue;
    await ctx.db.patch(listProperty._id, {
      sortOrder: index,
      updatedAt: now
    });
  }

  return reordered.map((listProperty, index) => ({
    ...listProperty,
    sortOrder: index,
    updatedAt: listProperty.sortOrder === index ? listProperty.updatedAt : now
  }));
}

export async function removeListPropertyHandler(
  ctx: ListsMutationCtx,
  { propertyId }: { propertyId: Id<'listProperties'> }
) {
  const { list, property } = await requireEditableProperty(ctx, propertyId);
  const propertyValues = await ctx.db
    .query('listItemPropertyValues')
    .withIndex('by_property_id', (q) => q.eq('listPropertyId', property._id))
    .collect();

  for (const propertyValue of propertyValues) {
    await ctx.db.delete(propertyValue._id);
  }

  await ctx.db.delete(property._id);

  const survivorProperties = sortListProperties(
    (await readListProperties(ctx, list._id)).filter((row) => row._id !== property._id)
  );

  for (const [index, survivor] of survivorProperties.entries()) {
    if (survivor.sortOrder === index) continue;
    await ctx.db.patch(survivor._id, {
      sortOrder: index
    });
  }

  return {
    propertyId,
    removedValueIds: propertyValues.map((propertyValue) => propertyValue._id)
  };
}

export async function setListItemPropertyValueHandler(
  ctx: ListsMutationCtx,
  args: { itemId: Id<'listItems'>; propertyId: Id<'listProperties'>; value: SetListItemPropertyValue }
) {
  const { list, item } = await requireEditableItem(ctx, args.itemId);
  const property = await findListPropertyById(ctx, args.propertyId);
  if (!property || property.listId !== list._id) throw new Error('List property unavailable');

  const now = Date.now();
  const valuePatch = buildPropertyValuePatch(property, args.value);
  const existing = await findItemPropertyValue(ctx, item._id, property._id);

  if (existing) {
    const patch = {
      ...valuePatch,
      updatedAt: now
    };
    await ctx.db.patch(existing._id, patch);
    return { ...existing, ...patch };
  }

  const row = {
    listItemId: item._id,
    listPropertyId: property._id,
    ...valuePatch,
    createdAt: now,
    updatedAt: now
  };
  const id = await ctx.db.insert('listItemPropertyValues', row);
  return { _id: id, ...row };
}

export async function clearListItemPropertyValueHandler(
  ctx: ListsMutationCtx,
  { itemId, propertyId }: { itemId: Id<'listItems'>; propertyId: Id<'listProperties'> }
) {
  const { list, item } = await requireEditableItem(ctx, itemId);
  const property = await findListPropertyById(ctx, propertyId);
  if (!property || property.listId !== list._id) throw new Error('List property unavailable');

  const existing = await findItemPropertyValue(ctx, item._id, property._id);
  if (existing) {
    await ctx.db.delete(existing._id);
  }

  return { itemId, propertyId };
}
