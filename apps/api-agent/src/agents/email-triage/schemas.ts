import { z } from 'zod';

export const emailNoticeCategories = ['school', 'admin', 'schedule', 'finance', 'other'] as const;
export const emailNoticePriorities = ['low', 'medium', 'high'] as const;
export const dueDateConfidences = ['low', 'medium', 'high'] as const;

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

export const emailTriageModelOutputSchema = z.object({
  outcome: z.enum(['notice', 'noNotice']),
  category: z.enum(emailNoticeCategories),
  priority: z.enum(emailNoticePriorities),
  title: z.string().max(120),
  body: z.string().max(600),
  extractedFacts: z.array(extractedFactSchema).max(12),
  reason: z.string().max(320),
  obligation: emailObligationModelSchema.nullable()
});

const emailObligationSchema = emailObligationModelSchema.extend({
  action: z.string().trim().min(1).max(240),
  dueOn: z.string().refine(isCalendarDate, 'Invalid obligation due date'),
  dueDateEvidence: z.string().trim().min(1).max(240)
});

export const emailTriageOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('notice'),
    category: z.enum(emailNoticeCategories),
    priority: z.enum(emailNoticePriorities),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(600),
    extractedFacts: z.array(extractedFactSchema).max(12),
    obligation: emailObligationSchema.nullable()
  }),
  z.object({
    kind: z.literal('noNotice'),
    reason: z.string().trim().min(1).max(320)
  })
]);

export function emailTriageOutcomeFromModel(output: z.infer<typeof emailTriageModelOutputSchema>) {
  return emailTriageOutcomeSchema.parse(
    output.outcome === 'notice'
      ? {
          kind: 'notice',
          category: output.category,
          priority: output.priority,
          title: output.title,
          body: output.body,
          extractedFacts: output.extractedFacts,
          obligation: output.obligation
        }
      : { kind: 'noNotice', reason: output.reason }
  );
}

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
  )
});

export type EmailTriageRunInput = z.infer<typeof emailTriageRunInputSchema>;
export type EmailTriageOutcome = z.infer<typeof emailTriageOutcomeSchema>;
