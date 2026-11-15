import { v } from 'convex/values';

import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from '../_generated/server';
import { scheduleListCategorisation } from '../lists/categorisation';
import { readGroceriesListForUser } from '../lists/groceries';
import { appendListItems, assertCanEditList } from '../lists/items';
import { enqueueWidgetInvalidation } from '../lists/widgetInvalidation';
import type { PaprikaImportCandidate } from './importSelection';

type ReadCtx = Pick<QueryCtx, 'db'>;

export const importCandidateValidator = v.object({
  uid: v.string(),
  title: v.string(),
  recipe: v.union(v.string(), v.null())
});

async function isImported(ctx: ReadCtx, userId: string, paprikaUid: string) {
  const row = await ctx.db
    .query('paprikaImportedItems')
    .withIndex('by_user_and_uid', (q) => q.eq('userId', userId).eq('paprikaUid', paprikaUid))
    .unique();
  return row !== null;
}

/** What an import needs to know before it reads Paprika's items. */
export async function readImportContextForUser(ctx: ReadCtx, { userId, uids }: { userId: string; uids: string[] }) {
  const connection = await ctx.db
    .query('paprikaConnections')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  const importedUids: string[] = [];
  for (const uid of uids) {
    if (await isImported(ctx, userId, uid)) importedUids.push(uid);
  }
  const hasGroceriesList = (await readGroceriesListForUser(ctx, userId)) !== null;
  return { sourceListUid: connection?.sourceListUid ?? null, importedUids, hasGroceriesList };
}

export type RecordImportResult =
  { status: 'imported'; importedUids: string[]; listName: string } | { status: 'no_groceries_list' };

/**
 * Adds the items to the person's Groceries list and remembers each one, all in one transaction.
 * Items already imported are skipped, so a repeated or overlapping import adds nothing twice,
 * unless the person asked to re-import them (`reimportUids`).
 * Categorisation and the widget refresh run once for the whole import.
 */
export async function recordImportForUser(
  ctx: Pick<MutationCtx, 'db' | 'scheduler'>,
  { userId, items, reimportUids = [] }: { userId: string; items: PaprikaImportCandidate[]; reimportUids?: string[] }
): Promise<RecordImportResult> {
  const reimport = new Set(reimportUids);
  const list = await readGroceriesListForUser(ctx, userId);
  if (!list) return { status: 'no_groceries_list' };
  assertCanEditList(list, userId);

  const fresh: PaprikaImportCandidate[] = [];
  const unrecorded = new Set<string>();
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.uid)) continue;
    const imported = await isImported(ctx, userId, item.uid);
    if (imported && !reimport.has(item.uid)) continue;
    seen.add(item.uid);
    fresh.push(item);
    if (!imported) unrecorded.add(item.uid);
  }

  const created = await appendListItems(
    ctx,
    list._id,
    fresh.map((item) => ({
      title: item.title,
      source: 'paprika' as const,
      ...(item.recipe ? { notes: `From ${item.recipe}` } : {})
    }))
  );

  const now = Date.now();
  for (const uid of unrecorded) {
    await ctx.db.insert('paprikaImportedItems', { userId, paprikaUid: uid, importedAt: now });
  }

  if (created.length) {
    await scheduleListCategorisation(ctx, { listId: list._id, itemIds: created.map((item) => item._id) });
    await enqueueWidgetInvalidation(ctx);
  }

  return { status: 'imported', importedUids: fresh.map((item) => item.uid), listName: list.name };
}

export const importContext = internalQuery({
  args: { userId: v.string(), uids: v.array(v.string()) },
  handler: async (ctx, args) => readImportContextForUser(ctx, args)
});

export const recordImport = internalMutation({
  args: { userId: v.string(), items: v.array(importCandidateValidator), reimportUids: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => recordImportForUser(ctx, args)
});
