import { internalMutation, type MutationCtx } from '../_generated/server';

export async function deleteExpiredEmailTriageRunsHandler(ctx: Pick<MutationCtx, 'db'>, now = Date.now()) {
  const expired = await ctx.db
    .query('emailTriageAgentRuns')
    .withIndex('by_expires_at', (q) => q.lt('expiresAt', now))
    .take(500);
  for (const row of expired) await ctx.db.delete(row._id);
  return expired.length;
}

export const deleteExpiredRuns = internalMutation({
  args: {},
  handler: (ctx) => deleteExpiredEmailTriageRunsHandler(ctx)
});
