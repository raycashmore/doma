import type { LanguageModel } from 'ai';
import { generateText, Output } from 'ai';

import { emailTriageModelOutputSchema, type EmailTriageRunInput } from './schemas.js';

export const EMAIL_TRIAGE_PROMPT_VERSION = 'email-triage-v1';

export const emailTriageInstructions = `You triage manually forwarded household administration emails for Doma.

Return a notice only when the email contains durable household information worth keeping on a shared noticeboard. Otherwise return noNotice. Preserve concise, factual wording and never invent private details.

An obligation is a concrete action or requirement with a due calendar date. Include one only when the source supports the action and date. Use YYYY-MM-DD for dueOn. Set dueDateConfidence high only when the date is explicitly anchored by the email content, such as a full calendar date or a relative date tied to an original message date. Unanchored phrases such as "tomorrow", "this Friday", or "next week" must be medium or low confidence. Never infer a deadline from the email receipt timestamp alone.

Use high priority only when forgetting the obligation would cause a meaningful missed commitment, cost, inability to participate, or household disruption. A high-confidence obligation is still not high priority unless the consequence warrants interruption. Return empty notice fields and a null obligation for noNotice.`;

function triagePrompt(input: EmailTriageRunInput) {
  return JSON.stringify({
    subject: input.subject,
    fromEmail: input.fromEmail,
    receivedAt: new Date(input.receivedAt).toISOString(),
    textBody: input.textBody,
    hasAttachments: input.hasAttachments,
    attachmentMetadata: input.attachmentMetadata
  });
}

export function generateEmailTriage({ model, input }: { model: LanguageModel; input: EmailTriageRunInput }) {
  return generateText({
    model,
    system: emailTriageInstructions,
    prompt: triagePrompt(input),
    output: Output.object({
      name: 'forwardedEmailTriage',
      description: 'A shared noticeboard outcome with an optional grounded household obligation.',
      schema: emailTriageModelOutputSchema
    }),
    timeout: { totalMs: 30_000 }
  });
}
