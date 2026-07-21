import { v } from 'convex/values';

import { mutation, type MutationCtx } from '../_generated/server';
import { readActiveBoard } from './activeBoard';
import { boardSourceKind } from './schema';

export type BoardSourceKind = 'today' | 'meals' | 'forwardedEmail' | 'monthlySpendingInsight' | 'manualNote';

type ArchiveMutationCtx = Pick<MutationCtx, 'auth' | 'db'>;
type ArchiveArgs = { occurrenceId: string; sourceKind: BoardSourceKind };
type ArchiveHandlerOptions = {
  timeZone: string;
  readBoard?: typeof readActiveBoard;
};

export async function archiveBoardItemHandler(
  ctx: ArchiveMutationCtx,
  args: ArchiveArgs,
  options: ArchiveHandlerOptions = { timeZone: process.env.SCHEDULE_TZ ?? 'Australia/Sydney' }
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const existing = await ctx.db
    .query('boardArchives')
    .withIndex('by_occurrence_id', (query) => query.eq('occurrenceId', args.occurrenceId))
    .unique();
  if (existing) return existing;

  const board = await (options.readBoard ?? readActiveBoard)(ctx, {
    now: new Date(),
    timeZone: options.timeZone,
    includeArchived: true
  });
  const item = board.items.find((candidate) => candidate.id === args.occurrenceId);
  if (!item || item.sourceKind !== args.sourceKind) throw new Error('Board item unavailable');

  const row = {
    occurrenceId: args.occurrenceId,
    sourceKind: args.sourceKind,
    archivedByUserId: identity.subject,
    archivedAt: Date.now()
  };
  const id = await ctx.db.insert('boardArchives', row);
  return { _id: id, ...row };
}

export const archiveBoardItem = mutation({
  args: { occurrenceId: v.string(), sourceKind: boardSourceKind },
  handler: archiveBoardItemHandler
});
