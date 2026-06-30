import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type CapturedEmailMutationCtx, captureForwardedEmailForBotHandler } from './capture';

type Row = Record<string, unknown> & { _id: string };

function createCtx(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    capturedEmails: [],
    ...structuredClone(seed)
  };
  let nextId = 1;

  const ctx = {
    db: {
      insert: async (table: string, row: Record<string, unknown>) => {
        const _id = `${table}_${nextId++}`;
        (tables[table] ??= []).push({ ...row, _id });
        return _id;
      },
      query: (table: string) => {
        const rows = () => tables[table] ?? [];
        return {
          withIndex: (_index: string, apply: (q: { eq: (field: string, value: unknown) => unknown }) => void) => {
            const eqs: Record<string, unknown> = {};
            const builder = {
              eq: (field: string, value: unknown) => {
                eqs[field] = value;
                return builder;
              }
            };
            apply(builder);
            const match = (row: Row) => Object.entries(eqs).every(([field, value]) => row[field] === value);
            return {
              unique: async () => rows().find(match) ?? null
            };
          }
        };
      }
    }
  };

  return { ctx: ctx as unknown as CapturedEmailMutationCtx, tables };
}

const capturedEmail = {
  provider: 'resend' as const,
  providerMessageId: 'resend-email-123',
  receivedAt: Date.parse('2026-06-30T08:15:00.000Z'),
  from: {
    email: 'ray@example.com',
    label: 'Ray'
  },
  to: ['triage@example.com'],
  subject: 'Library bag tomorrow',
  textBody: 'Please bring a library bag tomorrow.',
  htmlBody: '<p>Please bring a library bag tomorrow.</p>',
  hasAttachments: true,
  attachmentMetadata: [{ filename: 'notice.pdf', contentType: 'application/pdf' }]
};

describe('captureForwardedEmailForBotHandler', () => {
  beforeEach(() => {
    process.env.BOT_SERVICE_TOKEN = 'service-token';
  });

  afterEach(() => {
    delete process.env.BOT_SERVICE_TOKEN;
  });

  it('stores forwarded email source material as pending work and dedupes repeated provider messages', async () => {
    const { ctx, tables } = createCtx();

    const first = await captureForwardedEmailForBotHandler(ctx, {
      serviceToken: 'service-token',
      capturedAt: Date.parse('2026-06-30T08:16:00.000Z'),
      email: capturedEmail
    });
    const second = await captureForwardedEmailForBotHandler(ctx, {
      serviceToken: 'service-token',
      capturedAt: Date.parse('2026-06-30T08:17:00.000Z'),
      email: capturedEmail
    });

    expect(first).toEqual({
      status: 'created',
      capturedEmailId: 'capturedEmails_1'
    });
    expect(second).toEqual({
      status: 'duplicate',
      capturedEmailId: 'capturedEmails_1'
    });
    expect(tables.capturedEmails).toHaveLength(1);
    expect(tables.capturedEmails?.[0]).toMatchObject({
      provider: 'resend',
      providerMessageId: 'resend-email-123',
      fromEmail: 'ray@example.com',
      fromLabel: 'Ray',
      toEmails: ['triage@example.com'],
      subject: 'Library bag tomorrow',
      textBody: 'Please bring a library bag tomorrow.',
      htmlBody: '<p>Please bring a library bag tomorrow.</p>',
      hasAttachments: true,
      attachmentMetadata: [{ filename: 'notice.pdf', contentType: 'application/pdf' }],
      processingState: 'pending',
      receivedAt: Date.parse('2026-06-30T08:15:00.000Z'),
      capturedAt: Date.parse('2026-06-30T08:16:00.000Z'),
      updatedAt: Date.parse('2026-06-30T08:16:00.000Z'),
      rawBodyExpiresAt: Date.parse('2026-07-30T08:16:00.000Z'),
      metadataExpiresAt: Date.parse('2026-09-28T08:16:00.000Z')
    });
  });

  it('dedupes repeated forwards with different provider message IDs by message fingerprint', async () => {
    const { ctx, tables } = createCtx();

    const first = await captureForwardedEmailForBotHandler(ctx, {
      serviceToken: 'service-token',
      capturedAt: Date.parse('2026-06-30T08:16:00.000Z'),
      email: capturedEmail
    });
    const second = await captureForwardedEmailForBotHandler(ctx, {
      serviceToken: 'service-token',
      capturedAt: Date.parse('2026-06-30T08:17:00.000Z'),
      email: {
        ...capturedEmail,
        providerMessageId: 'resend-email-456',
        from: {
          email: ' RAY@example.com '
        },
        subject: ' Library   bag tomorrow ',
        textBody: ' Please bring a library bag tomorrow. '
      }
    });

    expect(first.status).toBe('created');
    expect(second).toEqual({
      status: 'duplicate',
      capturedEmailId: 'capturedEmails_1'
    });
    expect(tables.capturedEmails).toHaveLength(1);
  });

  it('rejects an invalid service token before storing email source material', async () => {
    const { ctx, tables } = createCtx();

    await expect(
      captureForwardedEmailForBotHandler(ctx, {
        serviceToken: 'wrong-token',
        capturedAt: Date.parse('2026-06-30T08:16:00.000Z'),
        email: capturedEmail
      })
    ).rejects.toThrow('Unauthorized');

    expect(tables.capturedEmails).toHaveLength(0);
  });
});
