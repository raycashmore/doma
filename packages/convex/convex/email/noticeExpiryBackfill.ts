import { internalMutation, type MutationCtx } from '../_generated/server';
import { emailNoticeExpiresAt } from './noticeLifecycle';

const defaultBatchSize = 100;

function normalizedBatchSize(batchSize: number | undefined) {
  if (batchSize === undefined) return defaultBatchSize;
  return Math.max(1, Math.floor(batchSize));
}

export async function backfillMissingEmailNoticeExpiries(
  ctx: Pick<MutationCtx, 'db'>,
  options?: { batchSize?: number }
): Promise<{ patched: number; hasMore: boolean }> {
  const batchSize = normalizedBatchSize(options?.batchSize);
  const missingNotices = await ctx.db
    .query('emailNotices')
    .withIndex('by_expires_at', (query) => query.eq('expiresAt', undefined))
    .take(batchSize + 1);
  const noticesToPatch = missingNotices.slice(0, batchSize);

  for (const notice of noticesToPatch) {
    await ctx.db.patch(notice._id, {
      expiresAt: emailNoticeExpiresAt({
        createdAt: notice.createdAt,
        obligation: notice.obligation ?? null,
        relevance: {
          relevantThrough: null,
          dateConfidence: 'low',
          dateEvidence: ''
        }
      })
    });
  }

  return { patched: noticesToPatch.length, hasMore: missingNotices.length > batchSize };
}

export const backfillMissingExpiries = internalMutation({
  args: {},
  handler: (ctx) => backfillMissingEmailNoticeExpiries(ctx)
});
