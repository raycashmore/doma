import { internalMutation, type MutationCtx } from '../_generated/server';

export async function deleteExpiredRunsHandler(ctx: Pick<MutationCtx, 'db'>, now = Date.now()) {
  const expired = await ctx.db
    .query('weeklyMealAgentRuns')
    .withIndex('by_expires_at', (q) => q.lt('expiresAt', now))
    .take(100);
  for (const row of expired) await ctx.db.delete(row._id);
  return expired.length;
}

export const deleteExpiredRuns = internalMutation({
  args: {},
  handler: (ctx) => deleteExpiredRunsHandler(ctx)
});
