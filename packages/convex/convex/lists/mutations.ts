import { v } from 'convex/values';
import { customAlphabet } from 'nanoid/non-secure';

import { mutation, type MutationCtx } from '../_generated/server';
import {
  clearCompletedListItemsHandler,
  clearListItemPropertyValueHandler,
  completeListItemHandler,
  createListItemHandler,
  createListPropertyHandler,
  deleteListItemHandler,
  removeListPropertyHandler,
  renameListItemHandler,
  reorderListItemHandler,
  reorderListPropertyHandler,
  setListItemPropertyValueHandler,
  uncompleteListItemHandler
} from './items';
import { buildListPublicId, slugifyListName } from './model';

const createSeed = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 8);
const CREATE_LIST_PUBLIC_ID_ATTEMPTS = 3;
const listPropertyType = v.union(
  v.literal('text'),
  v.literal('number'),
  v.literal('date'),
  v.literal('select'),
  v.literal('checkbox')
);
const listPropertyOption = v.object({
  id: v.string(),
  label: v.string()
});
const listItemPropertyValue = v.union(
  v.object({
    type: v.literal('text'),
    text: v.string()
  }),
  v.object({
    type: v.literal('number'),
    number: v.number()
  }),
  v.object({
    type: v.literal('date'),
    date: v.number()
  }),
  v.object({
    type: v.literal('select'),
    optionId: v.string()
  }),
  v.object({
    type: v.literal('checkbox'),
    checked: v.boolean()
  })
);

type ListsMutationCtx = Pick<MutationCtx, 'auth' | 'db'>;

export function assertCanEditList(
  row: { visibility: 'personal' | 'shared'; createdByUserId: string },
  currentUserId: string
) {
  if (row.visibility === 'shared') return;
  if (row.createdByUserId !== currentUserId) throw new Error('List unavailable');
}

export function renameListFields(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('List name is required');
  return { name: trimmed, slug: slugifyListName(trimmed) };
}

export function buildCanonicalListPath(list: { publicId: string; slug: string }) {
  return `/lists/l/${list.publicId}/${list.slug}`;
}

async function findListByPublicId(ctx: Pick<ListsMutationCtx, 'db'>, publicId: string) {
  return ctx.db
    .query('lists')
    .withIndex('by_public_id', (q) => q.eq('publicId', publicId))
    .unique();
}

export async function createUniqueListPublicId(ctx: Pick<ListsMutationCtx, 'db'>, createId: () => string = createSeed) {
  for (let attempt = 0; attempt < CREATE_LIST_PUBLIC_ID_ATTEMPTS; attempt += 1) {
    const publicId = buildListPublicId(createId());
    const existing = await findListByPublicId(ctx, publicId);
    if (!existing) return publicId;
  }

  throw new Error('Unable to create list');
}

export async function createListHandler(
  ctx: ListsMutationCtx,
  args: { name: string; visibility: 'personal' | 'shared' }
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const now = Date.now();
  const fields = renameListFields(args.name);
  const row = {
    publicId: await createUniqueListPublicId(ctx),
    visibility: args.visibility,
    createdByUserId: identity.subject,
    createdAt: now,
    updatedAt: now,
    ...fields
  };

  const id = await ctx.db.insert('lists', row);
  return { _id: id, ...row, canonicalPath: buildCanonicalListPath(row) };
}

export const createList = mutation({
  args: {
    name: v.string(),
    visibility: v.union(v.literal('personal'), v.literal('shared'))
  },
  handler: createListHandler
});

export async function renameListHandler(ctx: ListsMutationCtx, { publicId, name }: { publicId: string; name: string }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const row = await findListByPublicId(ctx, publicId);
  if (!row) throw new Error('List unavailable');

  assertCanEditList(row, identity.subject);
  const patch = { ...renameListFields(name), updatedAt: Date.now() };
  await ctx.db.patch(row._id, patch);

  return {
    ...row,
    ...patch,
    canonicalPath: buildCanonicalListPath({ publicId: row.publicId, slug: patch.slug })
  };
}

export const renameList = mutation({
  args: { publicId: v.string(), name: v.string() },
  handler: renameListHandler
});

export async function deleteListHandler(ctx: ListsMutationCtx, { publicId }: { publicId: string }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const row = await findListByPublicId(ctx, publicId);
  if (!row) throw new Error('List unavailable');

  assertCanEditList(row, identity.subject);
  await ctx.db.delete(row._id);
  return { publicId };
}

export const deleteList = mutation({
  args: { publicId: v.string() },
  handler: deleteListHandler
});

export const createListItem = mutation({
  args: {
    listPublicId: v.string(),
    title: v.string()
  },
  handler: createListItemHandler
});

export const renameListItem = mutation({
  args: {
    itemId: v.id('listItems'),
    title: v.string()
  },
  handler: renameListItemHandler
});

export const deleteListItem = mutation({
  args: {
    itemId: v.id('listItems')
  },
  handler: deleteListItemHandler
});

export const completeListItem = mutation({
  args: {
    itemId: v.id('listItems')
  },
  handler: completeListItemHandler
});

export const uncompleteListItem = mutation({
  args: {
    itemId: v.id('listItems')
  },
  handler: uncompleteListItemHandler
});

export const reorderListItem = mutation({
  args: {
    itemId: v.id('listItems'),
    targetIndex: v.number()
  },
  handler: reorderListItemHandler
});

export const clearCompletedListItems = mutation({
  args: {
    listPublicId: v.string()
  },
  handler: clearCompletedListItemsHandler
});

export const createListProperty = mutation({
  args: {
    listPublicId: v.string(),
    name: v.string(),
    type: listPropertyType,
    options: v.optional(v.array(listPropertyOption))
  },
  handler: createListPropertyHandler
});

export const reorderListProperty = mutation({
  args: {
    propertyId: v.id('listProperties'),
    targetIndex: v.number()
  },
  handler: reorderListPropertyHandler
});

export const removeListProperty = mutation({
  args: {
    propertyId: v.id('listProperties')
  },
  handler: removeListPropertyHandler
});

export const setListItemPropertyValue = mutation({
  args: {
    itemId: v.id('listItems'),
    propertyId: v.id('listProperties'),
    value: listItemPropertyValue
  },
  handler: setListItemPropertyValueHandler
});

export const clearListItemPropertyValue = mutation({
  args: {
    itemId: v.id('listItems'),
    propertyId: v.id('listProperties')
  },
  handler: clearListItemPropertyValueHandler
});
