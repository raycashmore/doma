import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const emailProviderValidator = v.literal('resend');

export const capturedEmailProcessingStateValidator = v.union(
  v.literal('pending'),
  v.literal('processing'),
  v.literal('noNotice'),
  v.literal('noticeCreated'),
  v.literal('failed')
);

export const attachmentMetadataValidator = v.object({
  filename: v.optional(v.string()),
  contentType: v.optional(v.string())
});

export const capturedEmailsTable = defineTable({
  provider: emailProviderValidator,
  providerMessageId: v.string(),
  messageFingerprint: v.string(),
  fromEmail: v.string(),
  fromLabel: v.optional(v.string()),
  toEmails: v.array(v.string()),
  subject: v.string(),
  textBody: v.string(),
  htmlBody: v.optional(v.string()),
  hasAttachments: v.boolean(),
  attachmentMetadata: v.array(attachmentMetadataValidator),
  processingState: capturedEmailProcessingStateValidator,
  receivedAt: v.number(),
  capturedAt: v.number(),
  updatedAt: v.number(),
  rawBodyExpiresAt: v.number(),
  metadataExpiresAt: v.number()
})
  .index('by_provider_message', ['provider', 'providerMessageId'])
  .index('by_fingerprint', ['messageFingerprint'])
  .index('by_processing_state', ['processingState', 'capturedAt']);
