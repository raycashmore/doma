import { describe, expect, it, vi } from 'vitest';

import {
  createOpenAiEmailTriageProvider,
  type EmailNoticesQueryCtx,
  type EmailTriageMutationCtx,
  processCapturedEmailForTriageHandler,
  processNextPendingCapturedEmailHandler,
  readCurrentEmailNotices
} from './triage';

type Row = Record<string, unknown> & { _id: string };
type TestCtx = EmailTriageMutationCtx & EmailNoticesQueryCtx;

function createCtx(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    capturedEmails: [],
    emailNotices: [],
    ...structuredClone(seed)
  };
  let nextId = 1;

  const ctx = {
    db: {
      get: async (id: string) =>
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null,
      insert: async (table: string, row: Record<string, unknown>) => {
        const _id = `${table}_${nextId++}`;
        (tables[table] ??= []).push({ ...row, _id });
        return _id;
      },
      patch: async (id: string, row: Record<string, unknown>) => {
        const existing = Object.values(tables)
          .flat()
          .find((candidate) => candidate._id === id);
        if (!existing) throw new Error(`Missing row ${id}`);
        Object.assign(existing, row);
      },
      query: (table: string) => {
        const rows = () => tables[table] ?? [];
        return {
          withIndex: (_index: string, apply?: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => ({
            collect: async () => {
              if (!apply) return rows();
              const eqs: Record<string, unknown> = {};
              const builder = {
                eq: (field: string, value: unknown) => {
                  eqs[field] = value;
                  return builder;
                }
              };
              apply(builder);
              return rows().filter((row) => Object.entries(eqs).every(([field, value]) => row[field] === value));
            }
          }),
          collect: async () => rows()
        };
      }
    },
    auth: {
      getUserIdentity: async () => ({ subject: 'user_123', tokenIdentifier: 'token_123' })
    }
  };

  return { ctx: ctx as unknown as TestCtx, tables };
}

const capturedEmail = {
  _id: 'capturedEmails_123',
  provider: 'resend',
  providerMessageId: 'resend-email-123',
  messageFingerprint: 'fingerprint',
  fromEmail: 'forwarder@example.com',
  toEmails: ['triage@example.com'],
  subject: 'Library bag tomorrow',
  textBody: 'Please bring a library bag tomorrow.',
  hasAttachments: false,
  attachmentMetadata: [],
  processingState: 'pending',
  receivedAt: Date.parse('2026-07-03T08:15:00.000Z'),
  capturedAt: Date.parse('2026-07-03T08:16:00.000Z'),
  updatedAt: Date.parse('2026-07-03T08:16:00.000Z'),
  rawBodyExpiresAt: Date.parse('2026-08-02T08:16:00.000Z'),
  metadataExpiresAt: Date.parse('2026-10-01T08:16:00.000Z')
};

describe('processCapturedEmailForTriageHandler', () => {
  it('creates a current notice for a notify-worthy captured email', async () => {
    const { ctx, tables } = createCtx({
      capturedEmails: [capturedEmail]
    });
    const provider = vi.fn(async () => ({
      outcome: 'notice',
      category: 'school',
      priority: 'medium',
      title: 'Bring library bag',
      body: 'Bring a library bag tomorrow.',
      extractedFacts: [{ label: 'item', value: 'library bag' }],
      telegramWorthy: true,
      reason: 'The email contains a concrete item to bring.'
    }));

    const result = await processCapturedEmailForTriageHandler(ctx, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: Date.parse('2026-07-03T08:20:00.000Z'),
      provider
    });

    expect(result).toEqual({
      status: 'noticeCreated',
      capturedEmailId: 'capturedEmails_123',
      noticeId: 'emailNotices_1'
    });
    expect(provider).toHaveBeenCalledWith({
      subject: 'Library bag tomorrow',
      fromEmail: 'forwarder@example.com',
      receivedAt: Date.parse('2026-07-03T08:15:00.000Z'),
      textBody: 'Please bring a library bag tomorrow.',
      hasAttachments: false,
      attachmentMetadata: []
    });
    expect(tables.emailNotices).toEqual([
      {
        _id: 'emailNotices_1',
        capturedEmailId: 'capturedEmails_123',
        category: 'school',
        priority: 'medium',
        title: 'Bring library bag',
        body: 'Bring a library bag tomorrow.',
        extractedFacts: [{ label: 'item', value: 'library bag' }],
        telegramWorthy: true,
        createdAt: Date.parse('2026-07-03T08:20:00.000Z'),
        updatedAt: Date.parse('2026-07-03T08:20:00.000Z')
      }
    ]);
    expect(tables.capturedEmails?.[0]).toMatchObject({
      processingState: 'noticeCreated',
      processedAt: Date.parse('2026-07-03T08:20:00.000Z'),
      updatedAt: Date.parse('2026-07-03T08:20:00.000Z')
    });
  });

  it('records a no-notice outcome without creating a current notice', async () => {
    const { ctx, tables } = createCtx({
      capturedEmails: [capturedEmail]
    });

    const result = await processCapturedEmailForTriageHandler(ctx, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: Date.parse('2026-07-03T08:20:00.000Z'),
      provider: async () => ({
        outcome: 'noNotice',
        category: 'other',
        priority: 'low',
        title: '',
        body: '',
        extractedFacts: [],
        telegramWorthy: false,
        reason: 'The email is an FYI with no durable action.'
      })
    });

    expect(result).toEqual({
      status: 'noNotice',
      capturedEmailId: 'capturedEmails_123'
    });
    expect(tables.emailNotices).toEqual([]);
    expect(tables.capturedEmails?.[0]).toMatchObject({
      processingState: 'noNotice',
      noNoticeReason: 'The email is an FYI with no durable action.',
      processedAt: Date.parse('2026-07-03T08:20:00.000Z'),
      updatedAt: Date.parse('2026-07-03T08:20:00.000Z')
    });
  });

  it('stores failure state when the AI response is malformed', async () => {
    const { ctx, tables } = createCtx({
      capturedEmails: [capturedEmail]
    });

    const result = await processCapturedEmailForTriageHandler(ctx, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: Date.parse('2026-07-03T08:20:00.000Z'),
      provider: async () => ({
        outcome: 'notice',
        category: 'school',
        priority: 'urgent',
        title: 'Bring library bag',
        body: 'Bring a library bag tomorrow.',
        extractedFacts: [],
        telegramWorthy: true,
        reason: 'Invalid priority should fail validation.'
      })
    });

    expect(result).toEqual({
      status: 'failed',
      capturedEmailId: 'capturedEmails_123',
      reason: 'invalid_ai_output'
    });
    expect(tables.emailNotices).toEqual([]);
    expect(tables.capturedEmails?.[0]).toMatchObject({
      processingState: 'failed',
      triageFailureReason: 'invalid_ai_output',
      processedAt: Date.parse('2026-07-03T08:20:00.000Z'),
      updatedAt: Date.parse('2026-07-03T08:20:00.000Z')
    });
  });

  it('stores failure state when the AI provider fails', async () => {
    const { ctx, tables } = createCtx({
      capturedEmails: [capturedEmail]
    });

    const result = await processCapturedEmailForTriageHandler(ctx, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: Date.parse('2026-07-03T08:20:00.000Z'),
      provider: async () => {
        throw new Error('provider unavailable');
      }
    });

    expect(result).toEqual({
      status: 'failed',
      capturedEmailId: 'capturedEmails_123',
      reason: 'provider_failure'
    });
    expect(tables.emailNotices).toEqual([]);
    expect(tables.capturedEmails?.[0]).toMatchObject({
      processingState: 'failed',
      triageFailureReason: 'provider_failure',
      processedAt: Date.parse('2026-07-03T08:20:00.000Z'),
      updatedAt: Date.parse('2026-07-03T08:20:00.000Z')
    });
  });

  it('processes the oldest pending captured email asynchronously', async () => {
    const olderPending = {
      ...capturedEmail,
      _id: 'capturedEmails_older',
      subject: 'Sports bag tomorrow',
      textBody: 'Please bring a sports bag tomorrow.',
      capturedAt: Date.parse('2026-07-03T08:10:00.000Z')
    };
    const newerPending = {
      ...capturedEmail,
      _id: 'capturedEmails_newer',
      subject: 'Hat reminder',
      textBody: 'Please bring a hat tomorrow.',
      capturedAt: Date.parse('2026-07-03T08:30:00.000Z')
    };
    const { ctx, tables } = createCtx({
      capturedEmails: [newerPending, olderPending]
    });

    const result = await processNextPendingCapturedEmailHandler(ctx, {
      processedAt: Date.parse('2026-07-03T08:40:00.000Z'),
      provider: async () => ({
        outcome: 'notice',
        category: 'school',
        priority: 'medium',
        title: 'Bring sports bag',
        body: 'Bring a sports bag tomorrow.',
        extractedFacts: [{ label: 'item', value: 'sports bag' }],
        telegramWorthy: true,
        reason: 'The email contains a concrete item to bring.'
      })
    });

    expect(result).toEqual({
      status: 'noticeCreated',
      capturedEmailId: 'capturedEmails_older',
      noticeId: 'emailNotices_1'
    });
    expect(tables.capturedEmails?.find((row) => row._id === 'capturedEmails_older')).toMatchObject({
      processingState: 'noticeCreated'
    });
    expect(tables.capturedEmails?.find((row) => row._id === 'capturedEmails_newer')).toMatchObject({
      processingState: 'pending'
    });
  });
});

describe('readCurrentEmailNotices', () => {
  it('rejects unauthenticated callers', async () => {
    const { ctx } = createCtx();
    await expect(
      readCurrentEmailNotices({
        ...ctx,
        auth: { getUserIdentity: async () => null }
      } as EmailNoticesQueryCtx)
    ).rejects.toThrow('Not authenticated');
  });

  it('returns unarchived notices newest first with Home-board fields', async () => {
    const { ctx } = createCtx({
      emailNotices: [
        {
          _id: 'emailNotices_older',
          capturedEmailId: 'capturedEmails_older',
          category: 'admin',
          priority: 'low',
          title: 'Older notice',
          body: 'Older notice body.',
          extractedFacts: [],
          telegramWorthy: false,
          createdAt: Date.parse('2026-07-03T08:10:00.000Z'),
          updatedAt: Date.parse('2026-07-03T08:10:00.000Z')
        },
        {
          _id: 'emailNotices_archived',
          capturedEmailId: 'capturedEmails_archived',
          category: 'school',
          priority: 'medium',
          title: 'Archived notice',
          body: 'Archived notice body.',
          extractedFacts: [],
          telegramWorthy: true,
          createdAt: Date.parse('2026-07-03T08:20:00.000Z'),
          updatedAt: Date.parse('2026-07-03T08:20:00.000Z'),
          archivedAt: Date.parse('2026-07-03T08:25:00.000Z')
        },
        {
          _id: 'emailNotices_newer',
          capturedEmailId: 'capturedEmails_newer',
          category: 'school',
          priority: 'medium',
          title: 'Bring library bag',
          body: 'Bring a library bag tomorrow.',
          extractedFacts: [{ label: 'item', value: 'library bag' }],
          telegramWorthy: true,
          createdAt: Date.parse('2026-07-03T08:30:00.000Z'),
          updatedAt: Date.parse('2026-07-03T08:30:00.000Z')
        }
      ]
    });

    await expect(readCurrentEmailNotices(ctx)).resolves.toEqual([
      {
        id: 'emailNotices_newer',
        capturedEmailId: 'capturedEmails_newer',
        category: 'school',
        priority: 'medium',
        title: 'Bring library bag',
        body: 'Bring a library bag tomorrow.',
        extractedFacts: [{ label: 'item', value: 'library bag' }],
        telegramWorthy: true,
        createdAt: Date.parse('2026-07-03T08:30:00.000Z'),
        updatedAt: Date.parse('2026-07-03T08:30:00.000Z')
      },
      {
        id: 'emailNotices_older',
        capturedEmailId: 'capturedEmails_older',
        category: 'admin',
        priority: 'low',
        title: 'Older notice',
        body: 'Older notice body.',
        extractedFacts: [],
        telegramWorthy: false,
        createdAt: Date.parse('2026-07-03T08:10:00.000Z'),
        updatedAt: Date.parse('2026-07-03T08:10:00.000Z')
      }
    ]);
  });
});

describe('createOpenAiEmailTriageProvider', () => {
  it('requests structured email triage output from OpenAI', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                outcome: 'noNotice',
                category: 'other',
                priority: 'low',
                title: '',
                body: '',
                extractedFacts: [],
                telegramWorthy: false,
                reason: 'The email has no durable action.'
              })
            }
          }
        ]
      })
    );
    const provider = createOpenAiEmailTriageProvider({
      apiKey: 'openai-key',
      model: 'triage-model',
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await expect(
      provider({
        subject: 'Newsletter',
        fromEmail: 'forwarder@example.com',
        receivedAt: Date.parse('2026-07-03T08:15:00.000Z'),
        textBody: 'General update only.',
        hasAttachments: false,
        attachmentMetadata: []
      })
    ).resolves.toEqual({
      outcome: 'noNotice',
      category: 'other',
      priority: 'low',
      title: '',
      body: '',
      extractedFacts: [],
      telegramWorthy: false,
      reason: 'The email has no durable action.'
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer openai-key',
          'content-type': 'application/json'
        },
        body: expect.any(String)
      })
    );
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      model: string;
      response_format: { type: string; json_schema: { name: string; strict: boolean } };
    };
    expect(body.model).toBe('triage-model');
    expect(body.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: {
        name: 'forwarded_email_triage',
        strict: true
      }
    });
  });
});
