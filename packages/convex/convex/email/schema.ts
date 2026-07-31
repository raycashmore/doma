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

export const dueDateConfidenceValidator = v.union(v.literal('low'), v.literal('medium'), v.literal('high'));

export const emailObligationValidator = v.object({
  action: v.string(),
  dueOn: v.string(),
  dueDateConfidence: dueDateConfidenceValidator,
  dueDateEvidence: v.string()
});

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
  obligation: v.optional(v.union(emailObligationValidator, v.null())),
  triageRunId: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  archivedAt: v.optional(v.number()),
  expiresAt: v.optional(v.number()),
  supersededAt: v.optional(v.number())
})
  .index('by_created_at', ['createdAt'])
  .index('by_expires_at', ['expiresAt'])
  .index('by_telegram_worthy', ['telegramWorthy', 'createdAt']);

export const emailReminderCandidatesTable = defineTable({
  noticeId: v.id('emailNotices'),
  capturedEmailId: v.id('capturedEmails'),
  action: v.string(),
  dueOn: v.string(),
  reminderAt: v.number(),
  triageRunId: v.string(),
  createdAt: v.number()
})
  .index('by_reminder_at', ['reminderAt'])
  .index('by_notice_id', ['noticeId']);

export const emailReminderDeliveryAttemptsTable = defineTable({
  reminderId: v.id('emailReminderCandidates'),
  recipientUserId: v.string(),
  attemptedAt: v.number(),
  status: v.union(v.literal('pending'), v.literal('sent'), v.literal('skipped'), v.literal('failed')),
  providerErrorCode: v.optional(v.string())
})
  .index('by_reminder_id', ['reminderId'])
  .index('by_reminder_recipient', ['reminderId', 'recipientUserId'])
  .index('by_attempted_at', ['attemptedAt']);

export const emailTriageAgentRunsTable = defineTable({
  runId: v.string(),
  capturedEmailId: v.id('capturedEmails'),
  model: v.string(),
  promptVersion: v.string(),
  startedAt: v.number(),
  completedAt: v.number(),
  expiresAt: v.number(),
  stopReason: v.string(),
  errorName: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  errorStatusCode: v.optional(v.number()),
  errorType: v.optional(v.string()),
  errorGenerationId: v.optional(v.string()),
  inputTokens: v.number(),
  outputTokens: v.number(),
  outcomeKind: v.union(v.literal('notice'), v.literal('noNotice'), v.literal('failed')),
  hasObligation: v.boolean(),
  validationStatus: v.union(v.literal('valid'), v.literal('invalid')),
  validationReason: v.optional(v.union(v.literal('invalid_ai_output'), v.literal('provider_failure')))
})
  .index('by_run_id', ['runId'])
  .index('by_expires_at', ['expiresAt']);

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
