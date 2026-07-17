import { internalMutation } from '../_generated/server';

export const deleteExpiredRuns = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('weeklyMealAgentRuns')
      .withIndex('by_expires_at', (q) => q.lt('expiresAt', Date.now()))
      .take(100);
    for (const row of expired) await ctx.db.delete(row._id);
    return expired.length;
  }
});
