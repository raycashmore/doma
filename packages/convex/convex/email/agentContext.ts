import { v } from 'convex/values';

import { mutation, type MutationCtx, query, type QueryCtx } from '../_generated/server';
import { readActiveEmailNoticeCandidates } from './noticeCandidates';

function requireAgentServiceToken(serviceToken: string) {
  const expectedToken = process.env.AGENT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) throw new Error('Unauthorized');
}

export async function readClaimedEmailInput(
  ctx: Pick<QueryCtx, 'db'>,
  args: { serviceToken: string; capturedEmailId: string },
  options: { nowMs?: number } = {}
) {
  requireAgentServiceToken(args.serviceToken);
  const email = await ctx.db.get(args.capturedEmailId as never);
  if (!email || !('processingState' in email) || email.processingState !== 'processing') return null;
  const activeNoticeCandidates = await readActiveEmailNoticeCandidates(ctx, { nowMs: options.nowMs ?? Date.now() });
  const { _id, subject, fromEmail, receivedAt, textBody, hasAttachments, attachmentMetadata } = email;
  return {
    capturedEmailId: _id,
    subject,
    fromEmail,
    receivedAt,
    textBody,
    hasAttachments,
    attachmentMetadata,
    activeNoticeCandidates
  };
}

export const claimedInput = query({
  args: { serviceToken: v.string(), capturedEmailId: v.id('capturedEmails') },
  handler: (ctx, args) => readClaimedEmailInput(ctx, args, { nowMs: Date.now() })
});

const traceArgs = {
  serviceToken: v.string(),
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
};

type EmailTriageAgentRunArgs = {
  serviceToken: string;
  runId: string;
  capturedEmailId: string;
  model: string;
  promptVersion: string;
  startedAt: number;
  completedAt: number;
  expiresAt: number;
  stopReason: string;
  errorName?: string;
  errorMessage?: string;
  errorStatusCode?: number;
  errorType?: string;
  errorGenerationId?: string;
  inputTokens: number;
  outputTokens: number;
  outcomeKind: 'notice' | 'noNotice' | 'failed';
  hasObligation: boolean;
  validationStatus: 'valid' | 'invalid';
  validationReason?: 'invalid_ai_output' | 'provider_failure';
};

export async function recordEmailTriageAgentRun(ctx: Pick<MutationCtx, 'db'>, args: EmailTriageAgentRunArgs) {
  requireAgentServiceToken(args.serviceToken);
  const row = { ...args };
  Reflect.deleteProperty(row, 'serviceToken');
  const existing = await ctx.db
    .query('emailTriageAgentRuns')
    .withIndex('by_run_id', (q) => q.eq('runId', row.runId))
    .unique();
  if (existing) return { runId: existing.runId };
  await ctx.db.insert('emailTriageAgentRuns', row as never);
  return { runId: row.runId };
}

export const recordRun = mutation({ args: traceArgs, handler: recordEmailTriageAgentRun });
