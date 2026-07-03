import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { action, internalAction, internalMutation, internalQuery, query } from '../_generated/server';

type CapturedEmailRow = Record<string, unknown> & {
  _id: string;
  fromEmail: string;
  subject: string;
  textBody: string;
  hasAttachments: boolean;
  attachmentMetadata: Array<{
    filename?: string;
    contentType?: string;
  }>;
  processingState: string;
  receivedAt: number;
  capturedAt: number;
};

export type EmailTriageInput = {
  subject: string;
  fromEmail: string;
  receivedAt: number;
  textBody: string;
  hasAttachments: boolean;
  attachmentMetadata: Array<{
    filename?: string;
    contentType?: string;
  }>;
};

export type EmailTriageProvider = (input: EmailTriageInput) => Promise<unknown>;

export type EmailTriageMutationCtx = {
  db: {
    get(id: string): Promise<CapturedEmailRow | null>;
    insert(table: 'emailNotices', row: Record<string, unknown>): Promise<string>;
    patch(id: string, row: Record<string, unknown>): Promise<void>;
    query(table: 'capturedEmails'): {
      withIndex(
        index: 'by_processing_state',
        apply: (q: { eq(field: 'processingState', value: 'pending'): unknown }) => unknown
      ): {
        collect(): Promise<CapturedEmailRow[]>;
      };
    };
  };
};

type EmailNoticeRow = Record<string, unknown> & {
  _id: string;
  capturedEmailId: string;
  category: EmailNoticeCategory;
  priority: EmailNoticePriority;
  title: string;
  body: string;
  extractedFacts: ExtractedFact[];
  telegramWorthy: boolean;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
};

export type EmailNoticesQueryCtx = {
  auth: {
    getUserIdentity: () => Promise<{ subject: string; tokenIdentifier: string } | null>;
  };
  db: {
    query(table: 'emailNotices'): {
      collect(): Promise<EmailNoticeRow[]>;
    };
  };
};

type ParsedNoticeTriage = {
  outcome: 'notice';
  category: EmailNoticeCategory;
  priority: EmailNoticePriority;
  title: string;
  body: string;
  extractedFacts: ExtractedFact[];
  telegramWorthy: boolean;
  reason: string;
};

type ParsedNoNoticeTriage = {
  outcome: 'noNotice';
  reason: string;
};

type ExtractedFact = {
  label: string;
  value: string;
};

type EmailNoticeCategory = 'school' | 'admin' | 'schedule' | 'finance' | 'other';
type EmailNoticePriority = 'low' | 'medium' | 'high';
type EmailTriageFailureReason = 'invalid_ai_output' | 'provider_failure' | 'setup_problem';
type TerminalCapturedEmailProcessingState = 'noNotice' | 'noticeCreated' | 'failed';

type TriageRefs = {
  claimNextPendingCapturedEmail: FunctionReference<
    'mutation',
    'internal',
    { claimedAt: number },
    CapturedEmailRow | null
  >;
  nextPendingCapturedEmail: FunctionReference<'query', 'internal', Record<string, never>, CapturedEmailRow | null>;
  processCapturedEmailTriageOutput: FunctionReference<
    'mutation',
    'internal',
    { capturedEmailId: string; processedAt: number; triage: unknown },
    unknown
  >;
  recordCapturedEmailTriageFailure: FunctionReference<
    'mutation',
    'internal',
    { capturedEmailId: string; processedAt: number; reason: EmailTriageFailureReason },
    unknown
  >;
};

const categories = new Set<EmailNoticeCategory>(['school', 'admin', 'schedule', 'finance', 'other']);
const priorities = new Set<EmailNoticePriority>(['low', 'medium', 'high']);
const terminalProcessingStates = new Set<TerminalCapturedEmailProcessingState>(['noNotice', 'noticeCreated', 'failed']);
const emailTriageProcessingLeaseMs = 15 * 60 * 1000;
const triageRefs = (
  internal as unknown as {
    email: {
      triage: TriageRefs;
    };
  }
).email.triage;

function assertAuthorizedServiceToken(serviceToken: string) {
  const expectedToken = process.env.BOT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) {
    throw new Error('Unauthorized');
  }
}

export const emailTriageSystemPrompt = [
  'You triage forwarded household admin emails for Doma.',
  'Decide whether the email contains a durable thing to remember, act on, bring, pay, sign, or plan around.',
  'Return noNotice for FYI-only, marketing, unclear, or low-value emails.',
  'When creating a notice, use generic concise wording and do not invent private details.',
  'Set telegramWorthy true only when the notice is timely or action-oriented enough to interrupt a chat recipient.',
  'Return only the requested structured object.'
].join('\n');

export const emailTriageOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['outcome', 'category', 'priority', 'title', 'body', 'extractedFacts', 'telegramWorthy', 'reason'],
  properties: {
    outcome: { type: 'string', enum: ['notice', 'noNotice'] },
    category: { type: 'string', enum: ['school', 'admin', 'schedule', 'finance', 'other'] },
    priority: { type: 'string', enum: ['low', 'medium', 'high'] },
    title: { type: 'string' },
    body: { type: 'string' },
    extractedFacts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'value'],
        properties: {
          label: { type: 'string' },
          value: { type: 'string' }
        }
      }
    },
    telegramWorthy: { type: 'boolean' },
    reason: { type: 'string' }
  }
} as const;

export function createOpenAiEmailTriageProvider({
  apiKey,
  model,
  fetchImpl = fetch
}: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): EmailTriageProvider {
  return async (input) => {
    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: emailTriageSystemPrompt },
          { role: 'user', content: JSON.stringify(input) }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'forwarded_email_triage',
            strict: true,
            schema: emailTriageOutputJsonSchema
          }
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Email triage AI request failed with status ${response.status}`);
    }
    const body = (await response.json()) as unknown;
    const content = openAiMessageContent(body);
    if (!content) throw new Error('Email triage AI response did not include JSON content');
    return JSON.parse(content) as unknown;
  };
}

function emailTriageProviderFromEnv(): EmailTriageProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.FORWARDED_EMAIL_TRIAGE_AI_MODEL;
  if (!apiKey || !model) return null;
  return createOpenAiEmailTriageProvider({ apiKey, model });
}

export async function readCurrentEmailNotices(ctx: EmailNoticesQueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
}

export async function processCapturedEmailForTriageHandler(
  ctx: EmailTriageMutationCtx,
  {
    capturedEmailId,
    processedAt,
    provider
  }: {
    capturedEmailId: string;
    processedAt: number;
    provider: EmailTriageProvider;
  }
) {
  const email = await ctx.db.get(capturedEmailId);
  if (!email) throw new Error('Captured email not found');
  if (email.processingState !== 'pending' && email.processingState !== 'processing') {
    return {
      status: email.processingState,
      capturedEmailId
    };
  }

  await ctx.db.patch(capturedEmailId, {
    processingState: 'processing',
    updatedAt: processedAt
  });

  let triage: ParsedNoticeTriage | ParsedNoNoticeTriage;
  try {
    triage = parseEmailTriage(
      await provider({
        subject: email.subject,
        fromEmail: email.fromEmail,
        receivedAt: email.receivedAt,
        textBody: email.textBody,
        hasAttachments: email.hasAttachments,
        attachmentMetadata: email.attachmentMetadata
      })
    );
  } catch (error) {
    const terminalState = await readTerminalCapturedEmailState(ctx, capturedEmailId);
    if (terminalState) {
      return {
        status: terminalState,
        capturedEmailId
      };
    }

    const reason = error instanceof EmailTriageParseError ? 'invalid_ai_output' : 'provider_failure';
    await ctx.db.patch(capturedEmailId, {
      processingState: 'failed',
      triageFailureReason: reason,
      processedAt,
      updatedAt: processedAt
    });

    return {
      status: 'failed' as const,
      capturedEmailId,
      reason
    };
  }

  const terminalState = await readTerminalCapturedEmailState(ctx, capturedEmailId);
  if (terminalState) {
    return {
      status: terminalState,
      capturedEmailId
    };
  }

  if (triage.outcome === 'noNotice') {
    await ctx.db.patch(capturedEmailId, {
      processingState: 'noNotice',
      noNoticeReason: triage.reason,
      processedAt,
      updatedAt: processedAt
    });

    return {
      status: 'noNotice' as const,
      capturedEmailId
    };
  }

  const noticeId = await ctx.db.insert('emailNotices', {
    capturedEmailId,
    category: triage.category,
    priority: triage.priority,
    title: triage.title,
    body: triage.body,
    extractedFacts: triage.extractedFacts,
    telegramWorthy: triage.telegramWorthy,
    createdAt: processedAt,
    updatedAt: processedAt
  });

  await ctx.db.patch(capturedEmailId, {
    processingState: 'noticeCreated',
    processedAt,
    updatedAt: processedAt
  });

  return {
    status: 'noticeCreated' as const,
    capturedEmailId,
    noticeId
  };
}

async function readTerminalCapturedEmailState(ctx: EmailTriageMutationCtx, capturedEmailId: string) {
  const latestEmail = await ctx.db.get(capturedEmailId);
  if (!latestEmail) throw new Error('Captured email not found');
  return isTerminalCapturedEmailProcessingState(latestEmail.processingState) ? latestEmail.processingState : null;
}

function isTerminalCapturedEmailProcessingState(value: string): value is TerminalCapturedEmailProcessingState {
  return terminalProcessingStates.has(value as TerminalCapturedEmailProcessingState);
}

export async function processNextPendingCapturedEmailHandler(
  ctx: EmailTriageMutationCtx,
  {
    processedAt,
    provider
  }: {
    processedAt: number;
    provider: EmailTriageProvider;
  }
) {
  const pending = await ctx.db
    .query('capturedEmails')
    .withIndex('by_processing_state', (q) => q.eq('processingState', 'pending'))
    .collect();
  const next = pending.toSorted((left, right) => left.capturedAt - right.capturedAt)[0];
  if (!next) {
    return {
      status: 'idle' as const
    };
  }

  return await processCapturedEmailForTriageHandler(ctx, {
    capturedEmailId: next._id,
    processedAt,
    provider
  });
}

function parseEmailTriage(value: unknown): ParsedNoticeTriage | ParsedNoNoticeTriage {
  if (!isRecord(value)) throw new EmailTriageParseError('Email triage response was not an object');
  if (value.outcome === 'noNotice') {
    if (
      !isCategory(value.category) ||
      !isPriority(value.priority) ||
      !Array.isArray(value.extractedFacts) ||
      value.extractedFacts.length > 0 ||
      value.telegramWorthy !== false ||
      !isNonEmptyString(value.reason)
    ) {
      throw new EmailTriageParseError('Email triage no-notice response was invalid');
    }

    return { outcome: 'noNotice', reason: value.reason };
  }

  if (
    value.outcome !== 'notice' ||
    !isCategory(value.category) ||
    !isPriority(value.priority) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.body) ||
    typeof value.telegramWorthy !== 'boolean' ||
    !isNonEmptyString(value.reason)
  ) {
    throw new EmailTriageParseError('Email triage response was invalid');
  }
  const extractedFacts = parseExtractedFacts(value.extractedFacts);
  if (!extractedFacts) throw new EmailTriageParseError('Email triage extracted facts were invalid');

  return {
    outcome: 'notice',
    category: value.category,
    priority: value.priority,
    title: value.title,
    body: value.body,
    extractedFacts,
    telegramWorthy: value.telegramWorthy,
    reason: value.reason
  };
}

class EmailTriageParseError extends Error {}

function parseExtractedFacts(value: unknown) {
  if (!Array.isArray(value)) return null;
  const facts = value.map((fact) => {
    if (!isRecord(fact) || !isNonEmptyString(fact.label) || !isNonEmptyString(fact.value)) return null;
    return { label: fact.label, value: fact.value };
  });
  return facts.every((fact): fact is ExtractedFact => fact !== null) ? facts : null;
}

function isCategory(value: unknown): value is EmailNoticeCategory {
  return typeof value === 'string' && categories.has(value as EmailNoticeCategory);
}

function isPriority(value: unknown): value is EmailNoticePriority {
  return typeof value === 'string' && priorities.has(value as EmailNoticePriority);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function openAiMessageContent(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.choices)) return null;
  const firstChoice = body.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
  return typeof firstChoice.message.content === 'string' ? firstChoice.message.content : null;
}

export const nextPendingCapturedEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query('capturedEmails')
      .withIndex('by_processing_state', (q) => q.eq('processingState', 'pending'))
      .collect();
    return pending.toSorted((left, right) => left.capturedAt - right.capturedAt)[0] ?? null;
  }
});

export const claimNextPendingCapturedEmail = internalMutation({
  args: {
    claimedAt: v.number()
  },
  handler: async (ctx, { claimedAt }) => {
    const pending = await ctx.db
      .query('capturedEmails')
      .withIndex('by_processing_state', (q) => q.eq('processingState', 'pending'))
      .collect();
    const staleProcessing = (
      await ctx.db
        .query('capturedEmails')
        .withIndex('by_processing_state', (q) => q.eq('processingState', 'processing'))
        .collect()
    ).filter((email) => claimedAt - email.updatedAt >= emailTriageProcessingLeaseMs);
    const next = [...pending, ...staleProcessing].toSorted((left, right) => left.capturedAt - right.capturedAt)[0];
    if (!next) return null;

    await ctx.db.patch(next._id, {
      processingState: 'processing',
      updatedAt: claimedAt
    });

    return {
      ...next,
      processingState: 'processing',
      updatedAt: claimedAt
    };
  }
});

export const processCapturedEmailTriageOutput = internalMutation({
  args: {
    capturedEmailId: v.id('capturedEmails'),
    processedAt: v.number(),
    triage: v.any()
  },
  handler: async (ctx, { capturedEmailId, processedAt, triage }) => {
    return await processCapturedEmailForTriageHandler(ctx as unknown as EmailTriageMutationCtx, {
      capturedEmailId,
      processedAt,
      provider: async () => triage
    });
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
    if (isTerminalCapturedEmailProcessingState(email.processingState)) {
      return {
        status: email.processingState,
        capturedEmailId
      };
    }

    await ctx.db.patch(capturedEmailId, {
      processingState: 'failed',
      triageFailureReason: reason,
      processedAt,
      updatedAt: processedAt
    });
    return {
      status: 'failed' as const,
      capturedEmailId,
      reason
    };
  }
});

export const processNextPendingCapturedEmailForBot = action({
  args: {
    serviceToken: v.string(),
    processedAt: v.optional(v.number())
  },
  handler: async (ctx, { serviceToken, processedAt }) => {
    assertAuthorizedServiceToken(serviceToken);

    const resolvedProcessedAt = processedAt ?? Date.now();
    const capturedEmail = await ctx.runMutation(triageRefs.claimNextPendingCapturedEmail, {
      claimedAt: resolvedProcessedAt
    });
    if (!capturedEmail) return { status: 'idle' as const };

    const provider = emailTriageProviderFromEnv();
    if (!provider) {
      return await ctx.runMutation(triageRefs.recordCapturedEmailTriageFailure, {
        capturedEmailId: capturedEmail._id,
        processedAt: resolvedProcessedAt,
        reason: 'setup_problem'
      });
    }

    let triage: unknown;
    try {
      triage = await provider({
        subject: capturedEmail.subject,
        fromEmail: capturedEmail.fromEmail,
        receivedAt: capturedEmail.receivedAt,
        textBody: capturedEmail.textBody,
        hasAttachments: capturedEmail.hasAttachments,
        attachmentMetadata: capturedEmail.attachmentMetadata
      });
    } catch {
      return await ctx.runMutation(triageRefs.recordCapturedEmailTriageFailure, {
        capturedEmailId: capturedEmail._id,
        processedAt: resolvedProcessedAt,
        reason: 'provider_failure'
      });
    }

    return await ctx.runMutation(triageRefs.processCapturedEmailTriageOutput, {
      capturedEmailId: capturedEmail._id,
      processedAt: resolvedProcessedAt,
      triage
    });
  }
});

export const runDueForwardedEmailTriage = internalAction({
  args: {},
  handler: async (ctx) => {
    const processedAt = Date.now();
    const capturedEmail = await ctx.runMutation(triageRefs.claimNextPendingCapturedEmail, {
      claimedAt: processedAt
    });
    if (!capturedEmail) return { status: 'idle' as const };

    const provider = emailTriageProviderFromEnv();
    if (!provider) {
      return await ctx.runMutation(triageRefs.recordCapturedEmailTriageFailure, {
        capturedEmailId: capturedEmail._id,
        processedAt,
        reason: 'setup_problem'
      });
    }

    let triage: unknown;
    try {
      triage = await provider({
        subject: capturedEmail.subject,
        fromEmail: capturedEmail.fromEmail,
        receivedAt: capturedEmail.receivedAt,
        textBody: capturedEmail.textBody,
        hasAttachments: capturedEmail.hasAttachments,
        attachmentMetadata: capturedEmail.attachmentMetadata
      });
    } catch {
      return await ctx.runMutation(triageRefs.recordCapturedEmailTriageFailure, {
        capturedEmailId: capturedEmail._id,
        processedAt,
        reason: 'provider_failure'
      });
    }

    return await ctx.runMutation(triageRefs.processCapturedEmailTriageOutput, {
      capturedEmailId: capturedEmail._id,
      processedAt,
      triage
    });
  }
});

export const currentEmailNotices = query({
  args: {},
  handler: (ctx) => readCurrentEmailNotices(ctx as unknown as EmailNoticesQueryCtx)
});
