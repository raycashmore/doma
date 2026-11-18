import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * One device login: a device that signed in with Clerk once and now swaps its own secret for
 * short-lived Convex tokens. Holds only a hash of the secret, so a copy of the table cannot sign in.
 */
export const devicesTable = defineTable({
  userId: v.string(),
  label: v.string(),
  tokenHash: v.string(),
  createdAt: v.number(),
  lastUsedAt: v.number()
})
  .index('by_token_hash', ['tokenHash'])
  .index('by_last_used_at', ['lastUsedAt']);
