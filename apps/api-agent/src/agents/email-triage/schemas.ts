import { z } from 'zod';

export const emailNoticeCategories = ['school', 'admin', 'schedule', 'finance', 'other'] as const;
export const emailNoticePriorities = ['low', 'medium', 'high'] as const;
export const dueDateConfidences = ['low', 'medium', 'high'] as const;
export const lifecycleDateConfidences = ['low', 'medium', 'high'] as const;

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string) {
  if (!calendarDatePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const extractedFactSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(240)
});

export const emailObligationModelSchema = z.object({
  action: z.string().max(240),
  dueOn: z.string().max(10),
  dueDateConfidence: z.enum(dueDateConfidences),
  dueDateEvidence: z.string().max(240)
});

const relevanceModelSchema = z
  .object({
    relevantThrough: z.unknown().optional(),
    dateConfidence: z.unknown().optional(),
    dateEvidence: z.unknown().optional()
  })
  .optional()
  .catch(undefined);

const supersessionModelSchema = z
  .object({
    noticeId: z.unknown().optional(),
    confidence: z.unknown().optional(),
    evidence: z.unknown().optional()
  })
  .optional()
  .catch(undefined);

export const emailTriageModelOutputSchema = z.object({
  outcome: z.enum(['notice', 'noNotice']),
  category: z.enum(emailNoticeCategories),
  priority: z.enum(emailNoticePriorities),
  title: z.string().max(120),
  body: z.string().max(600),
  extractedFacts: z.array(extractedFactSchema).max(12),
  reason: z.string().max(320),
  obligation: emailObligationModelSchema.nullable(),
  relevance: relevanceModelSchema,
  supersession: supersessionModelSchema
});

const emailObligationSchema = emailObligationModelSchema.extend({
  action: z.string().trim().min(1).max(240),
  dueOn: z.string().refine(isCalendarDate, 'Invalid obligation due date'),
  dueDateEvidence: z.string().trim().min(1).max(240)
});

const relevanceSchema = z.object({
  relevantThrough: z.string().refine(isCalendarDate, 'Invalid relevance date').nullable(),
  dateConfidence: z.enum(lifecycleDateConfidences),
  dateEvidence: z.string().trim().max(240)
});

const supersessionSchema = z.object({
  noticeId: z.string().max(128).nullable(),
  confidence: z.enum(lifecycleDateConfidences),
  evidence: z.string().trim().max(240)
});

export const emailTriageOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('notice'),
    category: z.enum(emailNoticeCategories),
    priority: z.enum(emailNoticePriorities),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(600),
    extractedFacts: z.array(extractedFactSchema).max(12),
    obligation: emailObligationSchema.nullable(),
    relevance: relevanceSchema,
    supersession: supersessionSchema
  }),
  z.object({
    kind: z.literal('noNotice'),
    reason: z.string().trim().min(1).max(320)
  })
]);

function normalizedRelevance(relevance: z.infer<typeof relevanceModelSchema>) {
  const dateEvidence = typeof relevance?.dateEvidence === 'string' ? relevance.dateEvidence.trim() : '';
  if (
    typeof relevance?.relevantThrough === 'string' &&
    isCalendarDate(relevance.relevantThrough) &&
    dateEvidence.length > 0 &&
    (relevance.dateConfidence === 'medium' || relevance.dateConfidence === 'high')
  ) {
    return { relevantThrough: relevance.relevantThrough, dateConfidence: relevance.dateConfidence, dateEvidence };
  }
  return { relevantThrough: null, dateConfidence: 'low' as const, dateEvidence: '' };
}

function normalizedSupersession(
  supersession: z.infer<typeof supersessionModelSchema>,
  candidateIds: ReadonlySet<string>
) {
  const evidence = typeof supersession?.evidence === 'string' ? supersession.evidence.trim() : '';
  if (
    typeof supersession?.noticeId === 'string' &&
    candidateIds.has(supersession.noticeId) &&
    supersession.confidence === 'high' &&
    evidence.length > 0
  ) {
    return { noticeId: supersession.noticeId, confidence: 'high' as const, evidence };
  }
  return { noticeId: null, confidence: 'low' as const, evidence: '' };
}

export function emailTriageOutcomeFromModel(
  output: z.infer<typeof emailTriageModelOutputSchema>,
  candidateIds: ReadonlySet<string>
) {
  return emailTriageOutcomeSchema.parse(
    output.outcome === 'notice'
      ? {
          kind: 'notice',
          category: output.category,
          priority: output.priority,
          title: output.title,
          body: output.body,
          extractedFacts: output.extractedFacts,
          obligation: output.obligation,
          relevance: normalizedRelevance(output.relevance),
          supersession: normalizedSupersession(output.supersession, candidateIds)
        }
      : { kind: 'noNotice', reason: output.reason }
  );
}

export const activeNoticeCandidateSchema = z.object({
  id: z.string().min(1).max(128),
  category: z.enum(emailNoticeCategories),
  title: z.string().max(120),
  body: z.string().max(600),
  extractedFacts: z.array(extractedFactSchema).max(12),
  obligation: z
    .object({
      action: z.string().max(240),
      dueOn: z.string().max(10)
    })
    .nullable(),
  createdAt: z.number()
});

export const emailTriageRunInputSchema = z.object({
  capturedEmailId: z.string().min(1),
  subject: z.string().max(500),
  fromEmail: z.string().email(),
  receivedAt: z.number(),
  textBody: z.string().max(200_000),
  hasAttachments: z.boolean(),
  attachmentMetadata: z.array(
    z.object({
      filename: z.string().optional(),
      contentType: z.string().optional()
    })
  ),
  activeNoticeCandidates: z.array(activeNoticeCandidateSchema).max(20)
});

export type EmailTriageRunInput = z.infer<typeof emailTriageRunInputSchema>;
export type EmailTriageOutcome = z.infer<typeof emailTriageOutcomeSchema>;
