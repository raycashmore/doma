import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { action, type ActionCtx, internalMutation, internalQuery, mutation, query } from '../_generated/server';
import { requireUserId } from '../lists/items';
import { fetchPaprikaGroceryLists, loginToPaprika, type PaprikaGroceryList } from './api';
import {
  disconnectForUser,
  markNeedsReconnectForUser,
  readConnectionViewForUser,
  readTokenForUser,
  refreshGroceryListsForUser,
  saveConnectionForUser,
  setSourceListForUser
} from './model';

// Calls to Paprika happen only when the person taps Connect or Check
// connection: one request each, never retried in a loop or on a schedule.

const groceryListValidator = v.object({ uid: v.string(), name: v.string(), isDefault: v.boolean() });

type PaprikaRefs = {
  saveConnection: FunctionReference<
    'mutation',
    'internal',
    { userId: string; token: string; groceryLists: PaprikaGroceryList[] },
    null
  >;
  refreshGroceryLists: FunctionReference<
    'mutation',
    'internal',
    { userId: string; groceryLists: PaprikaGroceryList[] },
    null
  >;
  markNeedsReconnect: FunctionReference<'mutation', 'internal', { userId: string }, null>;
  readToken: FunctionReference<'query', 'internal', { userId: string }, string | null>;
};

const paprikaRefs: PaprikaRefs = (internal as unknown as { paprika: { connection: PaprikaRefs } }).paprika.connection;

/** The signed-in person's Paprika connection, or null when they have not connected. */
export const getConnection = query({
  args: {},
  handler: async (ctx) => readConnectionViewForUser(ctx, await requireUserId(ctx))
});

type PaprikaCalls = { login: typeof loginToPaprika; fetchGroceryLists: typeof fetchPaprikaGroceryLists };
type PaprikaActionCtx = Pick<ActionCtx, 'auth' | 'runMutation' | 'runQuery'>;

const paprikaCalls: PaprikaCalls = { login: loginToPaprika, fetchGroceryLists: fetchPaprikaGroceryLists };

export async function connectHandler(
  ctx: PaprikaActionCtx,
  { email, password }: { email: string; password: string },
  calls: PaprikaCalls = paprikaCalls
): Promise<{ status: 'connected' | 'rejected' | 'unavailable' }> {
  const userId = await requireUserId(ctx);
  const login = await calls.login({ email: email.trim(), password });
  if (login.status !== 'ok') return { status: login.status };

  const lists = await calls.fetchGroceryLists(login.token);
  if (lists.status !== 'ok') return { status: lists.status };

  await ctx.runMutation(paprikaRefs.saveConnection, { userId, token: login.token, groceryLists: lists.lists });
  return { status: 'connected' };
}

export async function checkConnectionHandler(
  ctx: PaprikaActionCtx,
  calls: PaprikaCalls = paprikaCalls
): Promise<{ status: 'connected' | 'rejected' | 'unavailable' | 'not_connected' }> {
  const userId = await requireUserId(ctx);
  const token = await ctx.runQuery(paprikaRefs.readToken, { userId });
  if (!token) return { status: 'not_connected' };

  const lists = await calls.fetchGroceryLists(token);
  if (lists.status === 'rejected') {
    await ctx.runMutation(paprikaRefs.markNeedsReconnect, { userId });
    return { status: 'rejected' };
  }
  if (lists.status === 'unavailable') return { status: 'unavailable' };

  await ctx.runMutation(paprikaRefs.refreshGroceryLists, { userId, groceryLists: lists.lists });
  return { status: 'connected' };
}

export const connect = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => connectHandler(ctx, args)
});

/** Check the stored token still works, refreshing Paprika's list names. */
export const checkConnection = action({
  args: {},
  handler: async (ctx) => checkConnectionHandler(ctx)
});

export const setSourceList = mutation({
  args: { uid: v.string() },
  handler: async (ctx, { uid }) => setSourceListForUser(ctx, { userId: await requireUserId(ctx), uid })
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => disconnectForUser(ctx, { userId: await requireUserId(ctx) })
});

export const saveConnection = internalMutation({
  args: { userId: v.string(), token: v.string(), groceryLists: v.array(groceryListValidator) },
  handler: async (ctx, args) => {
    await saveConnectionForUser(ctx, args);
    return null;
  }
});

export const refreshGroceryLists = internalMutation({
  args: { userId: v.string(), groceryLists: v.array(groceryListValidator) },
  handler: async (ctx, args) => {
    await refreshGroceryListsForUser(ctx, args);
    return null;
  }
});

export const markNeedsReconnect = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await markNeedsReconnectForUser(ctx, args);
    return null;
  }
});

export const readToken = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => readTokenForUser(ctx, args)
});
