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
    relevantThrough: z.string().max(10),
    dateConfidence: z.enum(lifecycleDateConfidences),
    dateEvidence: z.string().max(240)
  })
  .superRefine((relevance, context) => {
    const hasDate = relevance.relevantThrough.length > 0;
    const hasEvidence = relevance.dateEvidence.trim().length > 0;
    const isGroundedDate = hasDate && isCalendarDate(relevance.relevantThrough);
    const isEmptyLifecycle = !hasDate && relevance.dateConfidence === 'low' && !hasEvidence;
    if (isEmptyLifecycle || (isGroundedDate && hasEvidence && relevance.dateConfidence !== 'low')) return;
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid relevance lifecycle metadata' });
  });

const supersessionModelSchema = z
  .object({
    noticeId: z.string().max(128),
    confidence: z.enum(lifecycleDateConfidences),
    evidence: z.string().max(240)
  })
  .superRefine((supersession, context) => {
    const hasNoticeId = supersession.noticeId.length > 0;
    const hasEvidence = supersession.evidence.trim().length > 0;
    const isEmptyLifecycle = !hasNoticeId && supersession.confidence === 'low' && !hasEvidence;
    if (isEmptyLifecycle || (hasNoticeId && supersession.confidence === 'high' && hasEvidence)) return;
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid supersession lifecycle metadata' });
  });

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

function relevanceFromModel(relevance: z.infer<typeof relevanceModelSchema>) {
  return relevanceSchema.parse({
    relevantThrough: relevance.relevantThrough || null,
    dateConfidence: relevance.dateConfidence,
    dateEvidence: relevance.dateEvidence.trim()
  });
}

function supersessionFromModel(
  supersession: z.infer<typeof supersessionModelSchema>,
  candidateIds: ReadonlySet<string>
) {
  const noticeId = supersession.noticeId || null;
  if (noticeId !== null) {
    z.string()
      .refine((candidateId) => candidateIds.has(candidateId), 'Supersession target was not supplied')
      .parse(noticeId);
  }
  return supersessionSchema.parse({
    noticeId,
    confidence: supersession.confidence,
    evidence: supersession.evidence.trim()
  });
}

export function emailTriageOutcomeFromModel(
  output: z.infer<typeof emailTriageModelOutputSchema>,
  candidateIds: ReadonlySet<string>
) {
  const validatedOutput = emailTriageModelOutputSchema.parse(output);
  return emailTriageOutcomeSchema.parse(
    validatedOutput.outcome === 'notice'
      ? {
          kind: 'notice',
          category: validatedOutput.category,
          priority: validatedOutput.priority,
          title: validatedOutput.title,
          body: validatedOutput.body,
          extractedFacts: validatedOutput.extractedFacts,
          obligation: validatedOutput.obligation,
          relevance: relevanceFromModel(validatedOutput.relevance),
          supersession: supersessionFromModel(validatedOutput.supersession, candidateIds)
        }
      : { kind: 'noNotice', reason: validatedOutput.reason }
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
