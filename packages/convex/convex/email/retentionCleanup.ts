import { internalMutation, type MutationCtx } from '../_generated/server';
import { processingLeaseMs } from './triage';

// Rows can hold large HTML bodies, so batches stay well inside Convex's per-mutation read limit.
const cleanupBatchSize = 25;

export const rawBodyExpiredFailureReason = 'raw_body_expired';

export async function clearExpiredCapturedEmailContent(ctx: Pick<MutationCtx, 'db'>, now = Date.now()) {
  const expiredBodies = await ctx.db
    .query('capturedEmails')
    .withIndex('by_raw_body_retention', (q) => q.eq('rawBodyClearedAt', undefined).lt('rawBodyExpiresAt', now))
    .take(cleanupBatchSize);
  // Failing a row mid-triage would discard the agent's result, so a live claim waits for a later run.
  const clearableBodies = expiredBodies.filter(
    (email) => email.processingState !== 'processing' || now - email.updatedAt >= processingLeaseMs
  );

  for (const email of clearableBodies) {
    const awaitingTriage = email.processingState === 'pending' || email.processingState === 'processing';
    await ctx.db.patch(email._id, {
      textBody: '',
      htmlBody: undefined,
      // The fingerprint embeds the body. Capture never computes a blank one, so these rows stop matching duplicates.
      messageFingerprint: '',
      rawBodyClearedAt: now,
      updatedAt: now,
      ...(awaitingTriage
        ? { processingState: 'failed' as const, triageFailureReason: rawBodyExpiredFailureReason, processedAt: now }
        : {})
    });
  }

  const expiredMetadata = await ctx.db
    .query('capturedEmails')
    .withIndex('by_metadata_retention', (q) => q.eq('metadataClearedAt', undefined).lt('metadataExpiresAt', now))
    .take(cleanupBatchSize);

  for (const email of expiredMetadata) {
    await ctx.db.patch(email._id, {
      messageFingerprint: '',
      fromEmail: '',
      fromLabel: undefined,
      toEmails: [],
      subject: '',
      attachmentMetadata: [],
      noNoticeReason: undefined,
      metadataClearedAt: now,
      updatedAt: now
    });
  }

  return { rawBodiesCleared: clearableBodies.length, metadataCleared: expiredMetadata.length };
}

export const clearExpiredContent = internalMutation({
  args: {},
  handler: (ctx) => clearExpiredCapturedEmailContent(ctx)
});
