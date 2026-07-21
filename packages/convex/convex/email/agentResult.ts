import { v } from 'convex/values';

import { internalMutation, type MutationCtx } from '../_generated/server';
import { reminderCandidateForNotice } from './reminders';

type Obligation = {
  action: string;
  dueOn: string;
  dueDateConfidence: 'low' | 'medium' | 'high';
  dueDateEvidence: string;
};

export type EmailTriageAgentResult =
  | {
      runId: string;
      status: 'completed';
      outcome:
        | { kind: 'noNotice'; reason: string }
        | {
            kind: 'notice';
            category: 'school' | 'admin' | 'schedule' | 'finance' | 'other';
            priority: 'low' | 'medium' | 'high';
            title: string;
            body: string;
            extractedFacts: Array<{ label: string; value: string }>;
            obligation: Obligation | null;
          };
    }
  | { runId: string; status: 'failed'; reason: 'invalid_ai_output' | 'provider_failure' };

type PersistenceCtx = Pick<MutationCtx, 'db'>;

export async function persistEmailTriageAgentResult(
  ctx: PersistenceCtx,
  {
    capturedEmailId,
    processedAt,
    result
  }: { capturedEmailId: string; processedAt: number; result: EmailTriageAgentResult }
) {
  const email = await ctx.db.get(capturedEmailId as never);
  if (!email) throw new Error('Captured email not found');
  if ('processingState' in email && ['noNotice', 'noticeCreated', 'failed'].includes(String(email.processingState))) {
    return { status: email.processingState, capturedEmailId };
  }

  if (result.status === 'failed') {
    await ctx.db.patch(capturedEmailId as never, {
      processingState: 'failed',
      triageFailureReason: result.reason,
      processedAt,
      updatedAt: processedAt
    });
    return { status: 'failed' as const, capturedEmailId, reason: result.reason };
  }

  if (result.outcome.kind === 'noNotice') {
    await ctx.db.patch(capturedEmailId as never, {
      processingState: 'noNotice',
      noNoticeReason: result.outcome.reason,
      processedAt,
      updatedAt: processedAt
    });
    return { status: 'noNotice' as const, capturedEmailId };
  }

  const outcome = result.outcome;
  const noticeId = await ctx.db.insert('emailNotices', {
    capturedEmailId: capturedEmailId as never,
    category: outcome.category,
    priority: outcome.priority,
    title: outcome.title,
    body: outcome.body,
    extractedFacts: outcome.extractedFacts,
    telegramWorthy: false,
    obligation: outcome.obligation,
    triageRunId: result.runId,
    createdAt: processedAt,
    updatedAt: processedAt
  });
  const candidate = reminderCandidateForNotice(
    {
      noticeId,
      capturedEmailId,
      priority: outcome.priority,
      obligation: outcome.obligation,
      triageRunId: result.runId
    },
    { processedAt }
  );
  const reminderCandidateId = candidate
    ? await ctx.db.insert('emailReminderCandidates', {
        ...candidate,
        noticeId,
        capturedEmailId: capturedEmailId as never
      })
    : undefined;

  await ctx.db.patch(capturedEmailId as never, {
    processingState: 'noticeCreated',
    processedAt,
    updatedAt: processedAt
  });
  return {
    status: 'noticeCreated' as const,
    capturedEmailId,
    noticeId,
    ...(reminderCandidateId ? { reminderCandidateId } : {})
  };
}

export const recordAgentResult = internalMutation({
  args: {
    capturedEmailId: v.id('capturedEmails'),
    processedAt: v.number(),
    result: v.any()
  },
  handler: (ctx, args) => persistEmailTriageAgentResult(ctx, args as never)
});
