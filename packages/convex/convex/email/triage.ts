import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { action, type ActionCtx, internalAction, internalMutation, mutation, query } from '../_generated/server';
import { isCalendarDate } from '../calendarDate';
import type { EmailNoticeSupersession, EmailTriageAgentResult } from './agentResult';
import type { EmailNoticeRelevance } from './noticeLifecycle';

type CapturedEmailRow = Record<string, unknown> & {
  _id: string;
  processingState: string;
  capturedAt: number;
  updatedAt: number;
};

type EmailNoticeRow = Record<string, unknown> & {
  _id: string;
  capturedEmailId: string;
  category: 'school' | 'admin' | 'schedule' | 'finance' | 'other';
  priority: 'low' | 'medium' | 'high';
  title: string;
  body: string;
  extractedFacts: Array<{ label: string; value: string }>;
  telegramWorthy: boolean;
  obligation?: {
    action: string;
    dueOn: string;
    dueDateConfidence: 'low' | 'medium' | 'high';
    dueDateEvidence: string;
  } | null;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
};

export type EmailNoticesQueryCtx = {
  auth: { getUserIdentity: () => Promise<{ subject: string; tokenIdentifier: string } | null> };
  db: { query(table: 'emailNotices'): { collect(): Promise<EmailNoticeRow[]> } };
};

type TriageRefs = {
  claimNextPendingCapturedEmail: FunctionReference<
    'mutation',
    'internal',
    { claimedAt: number },
    CapturedEmailRow | null
  >;
  recordCapturedEmailTriageFailure: FunctionReference<
    'mutation',
    'internal',
    {
      capturedEmailId: string;
      processedAt: number;
      reason: 'invalid_ai_output' | 'provider_failure' | 'setup_problem';
    },
    unknown
  >;
};

type AgentResultRefs = {
  recordAgentResult: FunctionReference<
    'mutation',
    'internal',
    { capturedEmailId: string; processedAt: number; result: EmailTriageAgentResult },
    unknown
  >;
};

const triageRefs: TriageRefs = (internal as unknown as { email: { triage: TriageRefs } }).email.triage;
const agentResultRefs: AgentResultRefs = (internal as unknown as { email: { agentResult: AgentResultRefs } }).email
  .agentResult;
const processingLeaseMs = 15 * 60 * 1000;

function assertAuthorizedServiceToken(serviceToken: string) {
  const expectedToken = process.env.BOT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) throw new Error('Unauthorized');
}

export async function readCurrentEmailNotices(ctx: EmailNoticesQueryCtx) {
  if (!(await ctx.auth.getUserIdentity())) throw new Error('Not authenticated');
  const rows = await ctx.db.query('emailNotices').collect();
  return rows
    .filter((row) => row.archivedAt === undefined)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((row) => ({
      id: row._id,
      capturedEmailId: row.capturedEmailId,
      category: row.category,
      priority: row.priority,
      title: row.title,
      body: row.body,
      extractedFacts: row.extractedFacts,
      telegramWorthy: row.telegramWorthy,
      obligation: row.obligation,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isMediumOrHigh(value: unknown): value is 'medium' | 'high' {
  return value === 'medium' || value === 'high';
}

function isNoticeCategory(value: unknown): value is 'school' | 'admin' | 'schedule' | 'finance' | 'other' {
  return value === 'school' || value === 'admin' || value === 'schedule' || value === 'finance' || value === 'other';
}

function isNoticePriority(value: unknown): value is 'low' | 'medium' | 'high' {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isNoticeObligation(
  value: unknown
): value is { action: string; dueOn: string; dueDateConfidence: 'low' | 'medium' | 'high'; dueDateEvidence: string } {
  return (
    isRecord(value) &&
    isNonEmptyString(value.action) &&
    typeof value.dueOn === 'string' &&
    isCalendarDate(value.dueOn) &&
    isNoticePriority(value.dueDateConfidence) &&
    isNonEmptyString(value.dueDateEvidence)
  );
}

function isExtractedFacts(value: unknown): value is Array<{ label: string; value: string }> {
  return (
    Array.isArray(value) &&
    value.every((fact) => isRecord(fact) && isNonEmptyString(fact.label) && isNonEmptyString(fact.value))
  );
}

function normalizedRelevance(value: unknown): EmailNoticeRelevance {
  if (
    isRecord(value) &&
    typeof value.relevantThrough === 'string' &&
    isCalendarDate(value.relevantThrough) &&
    isMediumOrHigh(value.dateConfidence) &&
    isNonEmptyString(value.dateEvidence)
  ) {
    return {
      relevantThrough: value.relevantThrough,
      dateConfidence: value.dateConfidence,
      dateEvidence: value.dateEvidence
    };
  }
  return { relevantThrough: null, dateConfidence: 'low', dateEvidence: '' };
}

function normalizedSupersession(value: unknown): EmailNoticeSupersession {
  if (
    isRecord(value) &&
    typeof value.noticeId === 'string' &&
    value.confidence === 'high' &&
    isNonEmptyString(value.evidence)
  ) {
    return { noticeId: value.noticeId, confidence: 'high', evidence: value.evidence };
  }
  return { noticeId: null, confidence: 'low', evidence: '' };
}

export function parseEmailTriageAgentResult(value: unknown): EmailTriageAgentResult | null {
  if (!isRecord(value) || typeof value.runId !== 'string') return null;
  if (value.status === 'failed') {
    return value.reason === 'invalid_ai_output' || value.reason === 'provider_failure'
      ? { runId: value.runId, status: 'failed', reason: value.reason }
      : null;
  }
  if (value.status !== 'completed' || !isRecord(value.outcome)) return null;
  const outcome = value.outcome;
  if (outcome.kind === 'noNotice' && isNonEmptyString(outcome.reason)) {
    return { runId: value.runId, status: 'completed', outcome: { kind: 'noNotice', reason: outcome.reason } };
  }
  if (
    outcome.kind !== 'notice' ||
    !isNoticeCategory(outcome.category) ||
    !isNoticePriority(outcome.priority) ||
    !isNonEmptyString(outcome.title) ||
    !isNonEmptyString(outcome.body) ||
    !isExtractedFacts(outcome.extractedFacts) ||
    !(outcome.obligation === null || isNoticeObligation(outcome.obligation))
  ) {
    return null;
  }
  return {
    runId: value.runId,
    status: 'completed',
    outcome: {
      kind: 'notice',
      category: outcome.category,
      priority: outcome.priority,
      title: outcome.title,
      body: outcome.body,
      extractedFacts: outcome.extractedFacts.map((fact) => ({ label: fact.label, value: fact.value })),
      obligation:
        outcome.obligation === null
          ? null
          : {
              action: outcome.obligation.action,
              dueOn: outcome.obligation.dueOn,
              dueDateConfidence: outcome.obligation.dueDateConfidence,
              dueDateEvidence: outcome.obligation.dueDateEvidence
            },
      relevance: normalizedRelevance(outcome.relevance),
      supersession: normalizedSupersession(outcome.supersession)
    }
  };
}

export async function requestEmailTriageAgent({
  capturedEmailId,
  origin,
  serviceToken,
  fetchImpl = fetch
}: {
  capturedEmailId: string;
  origin: string;
  serviceToken: string;
  fetchImpl?: typeof fetch;
}) {
  const response = await fetchImpl(new URL('/internal/email-triage', origin), {
    method: 'POST',
    headers: { authorization: `Bearer ${serviceToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ capturedEmailId })
  });
  if (!response.ok) throw new Error(`Email triage agent request failed with status ${response.status}`);
  const result = parseEmailTriageAgentResult(await response.json());
  if (!result) throw new Error('Email triage agent returned an invalid response');
  return result;
}

export async function runNextEmailTriage(
  ctx: Pick<ActionCtx, 'runMutation'>,
  {
    processedAt,
    agentOrigin,
    agentServiceToken,
    fetchImpl = fetch
  }: { processedAt: number; agentOrigin?: string; agentServiceToken?: string; fetchImpl?: typeof fetch }
): Promise<unknown> {
  const capturedEmail = await ctx.runMutation(triageRefs.claimNextPendingCapturedEmail, {
    claimedAt: processedAt
  });
  if (!capturedEmail) return { status: 'idle' as const };
  if (!agentOrigin || !agentServiceToken) {
    return await ctx.runMutation(triageRefs.recordCapturedEmailTriageFailure, {
      capturedEmailId: capturedEmail._id,
      processedAt,
      reason: 'setup_problem'
    });
  }
  let result: EmailTriageAgentResult;
  try {
    result = await requestEmailTriageAgent({
      capturedEmailId: capturedEmail._id,
      origin: agentOrigin,
      serviceToken: agentServiceToken,
      fetchImpl
    });
  } catch {
    return await ctx.runMutation(triageRefs.recordCapturedEmailTriageFailure, {
      capturedEmailId: capturedEmail._id,
      processedAt,
      reason: 'provider_failure'
    });
  }
  return await ctx.runMutation(agentResultRefs.recordAgentResult, {
    capturedEmailId: capturedEmail._id,
    processedAt,
    result
  });
}

export const claimNextPendingCapturedEmail = internalMutation({
  args: { claimedAt: v.number() },
  handler: async (ctx, { claimedAt }) => {
    const pending = await ctx.db
      .query('capturedEmails')
      .withIndex('by_processing_state', (q) => q.eq('processingState', 'pending'))
      .collect();
    const stale = (
      await ctx.db
        .query('capturedEmails')
        .withIndex('by_processing_state', (q) => q.eq('processingState', 'processing'))
        .collect()
    ).filter((email) => claimedAt - email.updatedAt >= processingLeaseMs);
    const next = [...pending, ...stale].sort((left, right) => left.capturedAt - right.capturedAt)[0];
    if (!next) return null;
    await ctx.db.patch(next._id, { processingState: 'processing', updatedAt: claimedAt });
    return { ...next, processingState: 'processing', updatedAt: claimedAt };
  }
});

export const recordCapturedEmailTriageFailure = internalMutation({
  args: {
    capturedEmailId: v.id('capturedEmails'),
    processedAt: v.number(),
    reason: v.union(v.literal('invalid_ai_output'), v.literal('provider_failure'), v.literal('setup_problem'))
  },
  handler: async (ctx, { capturedEmailId, processedAt, reason }) => {
    const email = await ctx.db.get(capturedEmailId);
    if (!email) throw new Error('Captured email not found');
    if (['noNotice', 'noticeCreated', 'failed'].includes(email.processingState)) {
      return { status: email.processingState, capturedEmailId };
    }
    await ctx.db.patch(capturedEmailId, {
      processingState: 'failed',
      triageFailureReason: reason,
      processedAt,
      updatedAt: processedAt
    });
    return { status: 'failed' as const, capturedEmailId, reason };
  }
});

export const retryFailedCapturedEmailForBot = mutation({
  args: { serviceToken: v.string(), capturedEmailId: v.id('capturedEmails') },
  handler: async (ctx, { serviceToken, capturedEmailId }) => {
    assertAuthorizedServiceToken(serviceToken);
    const email = await ctx.db.get(capturedEmailId);
    if (!email) throw new Error('Captured email not found');
    if (email.processingState !== 'failed') return { status: email.processingState, capturedEmailId };

    const retriedAt = Date.now();
    await ctx.db.patch(capturedEmailId, {
      processingState: 'pending',
      updatedAt: retriedAt,
      triageFailureReason: undefined
    });
    return { status: 'pending' as const, capturedEmailId };
  }
});

export const processNextPendingCapturedEmailForBot = action({
  args: { serviceToken: v.string(), processedAt: v.optional(v.number()) },
  handler: async (ctx, { serviceToken, processedAt }) => {
    assertAuthorizedServiceToken(serviceToken);
    return await runNextEmailTriage(ctx, {
      processedAt: processedAt ?? Date.now(),
      agentOrigin: process.env.AGENT_SERVICE_ORIGIN,
      agentServiceToken: process.env.AGENT_SERVICE_TOKEN
    });
  }
});

export const runDueForwardedEmailTriage = internalAction({
  args: {},
  handler: (ctx) =>
    runNextEmailTriage(ctx, {
      processedAt: Date.now(),
      agentOrigin: process.env.AGENT_SERVICE_ORIGIN,
      agentServiceToken: process.env.AGENT_SERVICE_TOKEN
    })
});

export const currentEmailNotices = query({
  args: {},
  handler: (ctx) => readCurrentEmailNotices(ctx as unknown as EmailNoticesQueryCtx)
});
