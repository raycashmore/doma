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

export const emailNoticeCategoryValidator = v.union(
  v.literal('school'),
  v.literal('admin'),
  v.literal('schedule'),
  v.literal('finance'),
  v.literal('other')
);

export const emailNoticePriorityValidator = v.union(v.literal('low'), v.literal('medium'), v.literal('high'));

export const attachmentMetadataValidator = v.object({
  filename: v.optional(v.string()),
  contentType: v.optional(v.string())
});

export const extractedFactValidator = v.object({
  label: v.string(),
  value: v.string()
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
  processedAt: v.optional(v.number()),
  triageFailureReason: v.optional(v.string()),
  noNoticeReason: v.optional(v.string()),
  rawBodyExpiresAt: v.number(),
  metadataExpiresAt: v.number()
})
  .index('by_provider_message', ['provider', 'providerMessageId'])
  .index('by_fingerprint', ['messageFingerprint'])
  .index('by_processing_state', ['processingState', 'capturedAt']);

export const emailNoticesTable = defineTable({
  capturedEmailId: v.id('capturedEmails'),
  category: emailNoticeCategoryValidator,
  priority: emailNoticePriorityValidator,
  title: v.string(),
  body: v.string(),
  extractedFacts: v.array(extractedFactValidator),
  telegramWorthy: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  archivedAt: v.optional(v.number())
})
  .index('by_created_at', ['createdAt'])
  .index('by_telegram_worthy', ['telegramWorthy', 'createdAt']);

export const emailNoticeDeliveryAttemptsTable = defineTable({
  noticeId: v.id('emailNotices'),
  recipientUserId: v.string(),
  attemptedAt: v.number(),
  status: v.union(v.literal('pending'), v.literal('sent'), v.literal('skipped'), v.literal('failed')),
  providerErrorCode: v.optional(v.string())
})
  .index('by_notice_id', ['noticeId'])
  .index('by_notice_recipient', ['noticeId', 'recipientUserId'])
  .index('by_attempted_at', ['attemptedAt']);
