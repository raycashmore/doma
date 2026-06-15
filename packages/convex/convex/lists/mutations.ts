import { v } from 'convex/values';
import { customAlphabet } from 'nanoid/non-secure';

import { mutation } from '../_generated/server';
import { buildListPublicId, slugifyListName } from './model';

const createSeed = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 8);

export function assertCanEditList(
  row: { visibility: 'personal' | 'shared'; createdByUserId: string },
  currentUserId: string
) {
  if (row.visibility === 'shared') return;
  if (row.createdByUserId !== currentUserId) throw new Error('List unavailable');
}

export function renameListFields(name: string) {
  const trimmed = name.trim();
  return { name: trimmed, slug: slugifyListName(trimmed) };
}

export function buildCanonicalListPath(list: { publicId: string; slug: string }) {
  return `/lists/l/${list.publicId}/${list.slug}`;
}

export const createList = mutation({
  args: {
    name: v.string(),
    visibility: v.union(v.literal('personal'), v.literal('shared'))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const now = Date.now();
    const fields = renameListFields(args.name);
    const row = {
      publicId: buildListPublicId(createSeed()),
      visibility: args.visibility,
      createdByUserId: identity.subject,
      createdAt: now,
      updatedAt: now,
      ...fields
    };

    const id = await ctx.db.insert('lists', row);
    return { _id: id, ...row, canonicalPath: buildCanonicalListPath(row) };
  }
});

export const renameList = mutation({
  args: { publicId: v.string(), name: v.string() },
  handler: async (ctx, { publicId, name }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const row = await ctx.db
      .query('lists')
      .withIndex('by_public_id', (q) => q.eq('publicId', publicId))
      .unique();
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
});

export const deleteList = mutation({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const row = await ctx.db
      .query('lists')
      .withIndex('by_public_id', (q) => q.eq('publicId', publicId))
      .unique();
    if (!row) throw new Error('List unavailable');

    assertCanEditList(row, identity.subject);
    await ctx.db.delete(row._id);
    return { publicId };
  }
});
