import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const paprikaGroceryList = v.object({ uid: v.string(), name: v.string() });

// One Paprika 4 connection per household user. The token is stored as Paprika
// issued it: an env-held key in the same deployment would add little against
// someone with dashboard or backup access. It never leaves the server, and the
// password is never stored. Grocery list names are cached at connect and on
// "Check connection" so the picker needs no call to Paprika. Items go to the
// person's Groceries list (lists/groceries.ts).
export const paprikaConnectionsTable = defineTable({
  userId: v.string(),
  token: v.string(),
  status: v.union(v.literal('connected'), v.literal('needs_reconnect')),
  groceryLists: v.array(paprikaGroceryList),
  sourceListUid: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number()
}).index('by_user', ['userId']);
