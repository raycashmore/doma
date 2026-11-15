import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { findListByPublicId, findSharedShoppingList, isListVisibleToUser } from '../lists/items';
import type { PaprikaGroceryList } from './api';

type ReadCtx = Pick<QueryCtx, 'db'>;
type WriteCtx = Pick<MutationCtx, 'db'>;

/** What a client may see of a connection. Never the token. */
export type PaprikaConnectionView = {
  status: Doc<'paprikaConnections'>['status'];
  groceryLists: Array<{ uid: string; name: string }>;
  sourceListUid: string | null;
  targetList: { publicId: string; name: string } | null;
};

async function findConnection(ctx: ReadCtx, userId: string) {
  return ctx.db
    .query('paprikaConnections')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
}

async function requireConnection(ctx: ReadCtx, userId: string) {
  const connection = await findConnection(ctx, userId);
  if (!connection) throw new Error('Paprika is not connected');
  return connection;
}

/** The target list, or null when it was deleted or is no longer visible to the user. */
async function readTargetList(ctx: ReadCtx, userId: string, targetListId: Id<'lists'> | undefined) {
  if (!targetListId) return null;
  const list = await ctx.db.get(targetListId);
  if (!list || !isListVisibleToUser(list, userId)) return null;
  return list;
}

export async function readConnectionViewForUser(ctx: ReadCtx, userId: string): Promise<PaprikaConnectionView | null> {
  const connection = await findConnection(ctx, userId);
  if (!connection) return null;

  const target = await readTargetList(ctx, userId, connection.targetListId);
  return {
    status: connection.status,
    groceryLists: connection.groceryLists,
    sourceListUid: connection.sourceListUid ?? null,
    targetList: target ? { publicId: target.publicId, name: target.name } : null
  };
}

/** Keep the chosen Paprika list while Paprika still has it; otherwise use Paprika's default list. */
function chooseSourceListUid(lists: PaprikaGroceryList[], current: string | undefined) {
  if (current && lists.some((list) => list.uid === current)) return current;
  return (lists.find((list) => list.isDefault) ?? lists[0])?.uid;
}

function cachedLists(lists: PaprikaGroceryList[]) {
  return lists.map(({ uid, name }) => ({ uid, name }));
}

/** Connect or reconnect. Earlier choices survive a reconnect while they are still valid. */
export async function saveConnectionForUser(
  ctx: WriteCtx,
  { userId, token, groceryLists }: { userId: string; token: string; groceryLists: PaprikaGroceryList[] }
) {
  const now = Date.now();
  const existing = await findConnection(ctx, userId);
  const keptTarget = await readTargetList(ctx, userId, existing?.targetListId);
  const targetListId = keptTarget?._id ?? (await findSharedShoppingList(ctx))?._id;
  const fields = {
    token,
    status: 'connected' as const,
    groceryLists: cachedLists(groceryLists),
    sourceListUid: chooseSourceListUid(groceryLists, existing?.sourceListUid),
    targetListId,
    updatedAt: now
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
  } else {
    await ctx.db.insert('paprikaConnections', { userId, createdAt: now, ...fields });
  }
}

/** A successful check with the stored token: refresh the cached lists. */
export async function refreshGroceryListsForUser(
  ctx: WriteCtx,
  { userId, groceryLists }: { userId: string; groceryLists: PaprikaGroceryList[] }
) {
  const connection = await requireConnection(ctx, userId);
  await ctx.db.patch(connection._id, {
    status: 'connected',
    groceryLists: cachedLists(groceryLists),
    sourceListUid: chooseSourceListUid(groceryLists, connection.sourceListUid),
    updatedAt: Date.now()
  });
}

/** Paprika refused the stored token. Choices are kept for the reconnect. */
export async function markNeedsReconnectForUser(ctx: WriteCtx, { userId }: { userId: string }) {
  const connection = await findConnection(ctx, userId);
  if (!connection) return;
  await ctx.db.patch(connection._id, { status: 'needs_reconnect', updatedAt: Date.now() });
}

export async function setSourceListForUser(ctx: WriteCtx, { userId, uid }: { userId: string; uid: string }) {
  const connection = await requireConnection(ctx, userId);
  if (!connection.groceryLists.some((list) => list.uid === uid)) throw new Error('Paprika list unavailable');
  await ctx.db.patch(connection._id, { sourceListUid: uid, updatedAt: Date.now() });
}

export async function setTargetListForUser(ctx: WriteCtx, { userId, publicId }: { userId: string; publicId: string }) {
  const connection = await requireConnection(ctx, userId);
  const list = await findListByPublicId(ctx, publicId);
  if (!list || !isListVisibleToUser(list, userId)) throw new Error('List unavailable');
  await ctx.db.patch(connection._id, { targetListId: list._id, updatedAt: Date.now() });
}

export async function disconnectForUser(ctx: WriteCtx, { userId }: { userId: string }) {
  const connection = await findConnection(ctx, userId);
  if (connection) await ctx.db.delete(connection._id);
}

/** Server-side only: the token for calls made on the user's behalf. */
export async function readTokenForUser(ctx: ReadCtx, { userId }: { userId: string }) {
  const connection = await findConnection(ctx, userId);
  return connection?.token ?? null;
}
