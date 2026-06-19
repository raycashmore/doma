import type { Id } from '../_generated/dataModel';
import type { ListsMutationCtx } from './items';
import {
  assertCanEditList,
  findItemPropertyValue,
  findListPropertyById,
  readListProperties,
  requireEditableItem,
  requireEditableProperty,
  requireVisibleList,
  sortListProperties
} from './items';

type ListPropertyType = 'text' | 'number' | 'date' | 'select' | 'checkbox';
type ListPropertyOption = { id: string; label: string };
type SetListItemPropertyValue =
  | { type: 'text'; text: string }
  | { type: 'number'; number: number }
  | { type: 'date'; date: number }
  | { type: 'select'; optionId: string }
  | { type: 'checkbox'; checked: boolean };

type ListItemRow = Awaited<ReturnType<typeof requireEditableItem>>['item'];

function normalizeListPropertyName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('List property name is required');
  return trimmed;
}

function normalizeListPropertyOptions(type: ListPropertyType, options?: ListPropertyOption[]) {
  if (type !== 'select') {
    if (options && options.length > 0) {
      throw new Error('List property options are only supported for select properties');
    }

    return undefined;
  }

  if (!options || options.length === 0) {
    throw new Error('List property options are required');
  }

  const normalizedOptions: ListPropertyOption[] = [];
  const seenOptionIds = new Set<string>();

  for (const option of options) {
    const id = option.id.trim();
    if (!id) throw new Error('List property option id is required');

    const label = option.label.trim();
    if (!label) throw new Error('List property option label is required');

    if (seenOptionIds.has(id)) throw new Error('List property option ids must be unique');
    seenOptionIds.add(id);
    normalizedOptions.push({ id, label });
  }

  return normalizedOptions;
}

async function serializeListItemPropertyValueMutation(ctx: ListsMutationCtx, item: ListItemRow, now: number) {
  await ctx.db.patch(item._id, {
    updatedAt: now
  });
}

function buildPropertyValuePatch(
  property: Awaited<ReturnType<typeof findListPropertyById>> extends infer T ? NonNullable<T> : never,
  value: SetListItemPropertyValue
) {
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

export async function renameListPropertyHandler(
  ctx: ListsMutationCtx,
  { propertyId, name }: { propertyId: Id<'listProperties'>; name: string }
) {
  const { property } = await requireEditableProperty(ctx, propertyId);
  const patch = {
    name: normalizeListPropertyName(name),
    updatedAt: Date.now()
  };

  await ctx.db.patch(property._id, patch);
  return { ...property, ...patch };
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
  const now = Date.now();

  for (const [index, survivor] of survivorProperties.entries()) {
    if (survivor.sortOrder === index) continue;
    await ctx.db.patch(survivor._id, {
      sortOrder: index,
      updatedAt: now
    });
  }

  return {
    propertyId,
    removedValueIds: propertyValues.map((propertyValue) => propertyValue._id)
  };
}

export async function replaceListPropertyOptionsHandler(
  ctx: ListsMutationCtx,
  { propertyId, options }: { propertyId: Id<'listProperties'>; options: ListPropertyOption[] }
) {
  const { property } = await requireEditableProperty(ctx, propertyId);
  if (property.type !== 'select') {
    throw new Error('List property options are only supported for select properties');
  }

  const normalizedOptions = normalizeListPropertyOptions('select', options);
  if (!normalizedOptions) {
    throw new Error('List property options are required');
  }

  const patch = {
    options: normalizedOptions,
    updatedAt: Date.now()
  };
  await ctx.db.patch(property._id, patch);

  const allowedOptionIds = new Set(normalizedOptions.map((option) => option.id));
  const propertyValues = await ctx.db
    .query('listItemPropertyValues')
    .withIndex('by_property_id', (q) => q.eq('listPropertyId', property._id))
    .collect();

  for (const propertyValue of propertyValues) {
    if (propertyValue.selectOptionId && !allowedOptionIds.has(propertyValue.selectOptionId)) {
      await ctx.db.delete(propertyValue._id);
    }
  }

  return { ...property, ...patch };
}

export async function setListItemPropertyValueHandler(
  ctx: ListsMutationCtx,
  args: { itemId: Id<'listItems'>; propertyId: Id<'listProperties'>; value: SetListItemPropertyValue }
) {
  const { list, item } = await requireEditableItem(ctx, args.itemId);
  const property = await findListPropertyById(ctx, args.propertyId);
  if (!property || property.listId !== list._id) throw new Error('List property unavailable');

  const now = Date.now();
  await serializeListItemPropertyValueMutation(ctx, item, now);
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
    listId: list._id,
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

  const now = Date.now();
  await serializeListItemPropertyValueMutation(ctx, item, now);
  const existing = await findItemPropertyValue(ctx, item._id, property._id);
  if (existing) {
    await ctx.db.delete(existing._id);
  }

  return { itemId, propertyId };
}
