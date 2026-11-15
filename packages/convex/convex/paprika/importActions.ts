'use node';

import { gzipSync } from 'node:zlib';

import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { action, type ActionCtx } from '../_generated/server';
import { requireUserId } from '../lists/items';
import { deletePaprikaGroceries, fetchPaprikaGroceries } from './api';
import type { RecordImportResult } from './imports';
import { type PaprikaImportCandidate, selectImportableItems, toCandidate } from './importSelection';

// Each tap makes one read of Paprika's grocery items; an import adds one write
// to remove the imported items. Never retried in a loop or on a schedule.

type ImportRefs = {
  importContext: FunctionReference<
    'query',
    'internal',
    { userId: string; uids: string[] },
    { sourceListUid: string | null; importedUids: string[]; hasGroceriesList: boolean }
  >;
  recordImport: FunctionReference<
    'mutation',
    'internal',
    { userId: string; items: PaprikaImportCandidate[]; reimportUids?: string[] },
    RecordImportResult
  >;
};
type ConnectionRefs = {
  readToken: FunctionReference<'query', 'internal', { userId: string }, string | null>;
  markNeedsReconnect: FunctionReference<'mutation', 'internal', { userId: string }, null>;
};

const paprikaInternal = (internal as unknown as { paprika: { imports: ImportRefs; connection: ConnectionRefs } })
  .paprika;

/** A call to Paprika that did not work, as the app sees it. Never carries the token. */
type PaprikaFailure =
  { status: 'rejected'; reason: string | null } | { status: 'unavailable'; httpStatus: number | null };

type ImportActionCtx = Pick<ActionCtx, 'auth' | 'runMutation' | 'runQuery'>;
type ImportCalls = {
  fetchGroceries: typeof fetchPaprikaGroceries;
  deleteGroceries: (
    token: string,
    items: Parameters<typeof deletePaprikaGroceries>[1]
  ) => ReturnType<typeof deletePaprikaGroceries>;
};

const importCalls: ImportCalls = {
  fetchGroceries: fetchPaprikaGroceries,
  deleteGroceries: (token, items) => deletePaprikaGroceries(token, items, (data) => new Uint8Array(gzipSync(data)))
};

function reportFailure(step: string, failure: PaprikaFailure): PaprikaFailure {
  console.warn(`Paprika ${step} ${failure.status}`, failure);
  return failure;
}

/** Reads the person's token and Paprika's items, marking the connection for reconnect if Paprika refuses it. */
async function readImportable(ctx: ImportActionCtx, userId: string, calls: ImportCalls, step: string) {
  const token = await ctx.runQuery(paprikaInternal.connection.readToken, { userId });
  if (!token) return { status: 'not_connected' as const };

  const groceries = await calls.fetchGroceries(token);
  if (groceries.status === 'rejected') await ctx.runMutation(paprikaInternal.connection.markNeedsReconnect, { userId });
  if (groceries.status !== 'ok') return reportFailure(step, groceries);

  const context = await ctx.runQuery(paprikaInternal.imports.importContext, {
    userId,
    uids: groceries.items.map((item) => item.uid)
  });
  if (!context.hasGroceriesList) return { status: 'no_groceries_list' as const };
  return { status: 'ok' as const, token, ...selectImportableItems(groceries.items, context) };
}

export async function previewImportHandler(
  ctx: ImportActionCtx,
  calls: ImportCalls = importCalls
): Promise<
  | { status: 'ok'; items: PaprikaImportCandidate[]; alreadyImported: PaprikaImportCandidate[] }
  | { status: 'not_connected' }
  | { status: 'no_groceries_list' }
  | PaprikaFailure
> {
  const userId = await requireUserId(ctx);
  const result = await readImportable(ctx, userId, calls, 'import preview');
  if (result.status !== 'ok') return result;
  return {
    status: 'ok',
    items: result.newItems.map(toCandidate),
    alreadyImported: result.importedItems.map(toCandidate)
  };
}

type ImportOutcome =
  | {
      status: 'imported';
      count: number;
      listName: string;
      /** Whether the imported items were removed from Paprika. */
      removal: 'removed' | 'kept' | 'failed';
    }
  | { status: 'not_connected' }
  | { status: 'no_groceries_list' }
  | PaprikaFailure;

export async function importItemsHandler(
  ctx: ImportActionCtx,
  {
    uids,
    reimportUids = [],
    removeFromPaprika
  }: { uids: string[]; reimportUids?: string[]; removeFromPaprika: boolean },
  calls: ImportCalls = importCalls
): Promise<ImportOutcome> {
  const userId = await requireUserId(ctx);
  // Read again rather than trust the preview: items may have changed in Paprika, and removing
  // one needs the whole item as Paprika has it now.
  const result = await readImportable(ctx, userId, calls, 'import');
  if (result.status !== 'ok') return result;

  const wanted = new Set(uids);
  const reimport = new Set(reimportUids);
  // A re-import is only an item Paprika still has that was imported before, never one read as new.
  const reimported = result.importedItems.filter((item) => reimport.has(item.uid));
  const selected = [...result.newItems.filter((item) => wanted.has(item.uid)), ...reimported];
  const recorded = await ctx.runMutation(paprikaInternal.imports.recordImport, {
    userId,
    items: selected.map(toCandidate),
    reimportUids: reimported.map((item) => item.uid)
  });
  if (recorded.status !== 'imported') return recorded;

  const imported = new Set(recorded.importedUids);
  const toRemove = selected.filter((item) => imported.has(item.uid));
  let removal: 'removed' | 'kept' | 'failed' = 'kept';
  if (removeFromPaprika && toRemove.length) {
    const deleted = await calls.deleteGroceries(result.token, toRemove);
    if (deleted.status === 'ok') {
      removal = 'removed';
    } else {
      if (deleted.status === 'rejected') {
        await ctx.runMutation(paprikaInternal.connection.markNeedsReconnect, { userId });
      }
      reportFailure('remove after import', deleted);
      removal = 'failed';
    }
  }

  return { status: 'imported', count: toRemove.length, listName: recorded.listName, removal };
}

/** The person's Paprika items still to buy: new ones, and ones imported before that are still in Paprika. */
export const previewImport = action({
  args: {},
  handler: async (ctx) => previewImportHandler(ctx)
});

/**
 * Adds the chosen items to the person's Groceries list, then removes them from Paprika when asked.
 * `reimportUids` are items imported before that the person chose to bring in again.
 */
export const importItems = action({
  args: { uids: v.array(v.string()), reimportUids: v.optional(v.array(v.string())), removeFromPaprika: v.boolean() },
  handler: async (ctx, args) => importItemsHandler(ctx, args)
});
