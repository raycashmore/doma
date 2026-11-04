import { describe, expect, it, vi } from 'vitest';

import { captureForwardedEmailForBotHandler, type ForwardedEmailCaptureInput } from './capture';
import { clearExpiredCapturedEmailContent } from './retentionCleanup';

const day = 24 * 60 * 60 * 1_000;
const now = Date.parse('2026-11-04T00:00:00.000Z');

type EmailRow = Record<string, unknown> & { _id: string };

function capturedEmail(id: string, ageInDays: number, overrides: Record<string, unknown> = {}): EmailRow {
  const capturedAt = now - ageInDays * day;
  return {
    _id: id,
    provider: 'resend',
    providerMessageId: `message_${id}`,
    messageFingerprint: 'resend|sender@example.com|term dates|bring a hat',
    fromEmail: 'sender@example.com',
    fromLabel: 'Example Sender',
    toEmails: ['household@example.com'],
    subject: 'Term dates',
    textBody: 'Bring a hat.',
    htmlBody: '<p>Bring a hat.</p>',
    hasAttachments: true,
    attachmentMetadata: [{ filename: 'term-dates.pdf', contentType: 'application/pdf' }],
    processingState: 'noticeCreated',
    noNoticeReason: 'A generic reason.',
    receivedAt: capturedAt,
    capturedAt,
    updatedAt: capturedAt,
    rawBodyExpiresAt: capturedAt + 30 * day,
    metadataExpiresAt: capturedAt + 90 * day,
    ...overrides
  };
}

function createCtx(emails: EmailRow[]) {
  const rows = new Map(emails.map((email) => [email._id, email]));
  const patchCounts = new Map<string, number>();

  function withIndex(
    _index: string,
    range: (q: { eq: (field: string, value: unknown) => { lt: (field: string, value: number) => unknown } }) => unknown
  ) {
    let clearedField = '';
    let expiryField = '';
    let cutoff = 0;
    range({
      eq: (field) => {
        clearedField = field;
        return {
          lt: (field, value) => {
            expiryField = field;
            cutoff = value;
            return undefined;
          }
        };
      }
    });
    return {
      take: async (limit: number) =>
        [...rows.values()]
          .filter((row) => row[clearedField] === undefined && (row[expiryField] as number) < cutoff)
          .slice(0, limit)
    };
  }

  return {
    rows,
    patchCounts,
    ctx: {
      db: {
        query: () => ({ withIndex }),
        patch: async (id: string, value: Record<string, unknown>) => {
          patchCounts.set(id, (patchCounts.get(id) ?? 0) + 1);
          const row = rows.get(id);
          if (!row) throw new Error('Missing row');
          for (const [key, fieldValue] of Object.entries(value)) {
            if (fieldValue === undefined) Reflect.deleteProperty(row, key);
            else row[key] = fieldValue;
          }
        }
      }
    }
  };
}

function storedText(row: EmailRow | undefined) {
  return JSON.stringify(row).toLowerCase();
}

function cleanup(ctx: ReturnType<typeof createCtx>['ctx'], at = now) {
  return clearExpiredCapturedEmailContent(ctx as never, at);
}

describe('clearExpiredCapturedEmailContent', () => {
  it('leaves an email inside the retention window untouched', async () => {
    const email = capturedEmail('fresh', 29);
    const before = { ...email };
    const { ctx, rows } = createCtx([email]);

    await expect(cleanup(ctx)).resolves.toEqual({ rawBodiesCleared: 0, metadataCleared: 0 });

    expect(rows.get('fresh')).toEqual(before);
  });

  it('removes every copy of the body after 30 days and keeps the metadata', async () => {
    const { ctx, rows } = createCtx([capturedEmail('old', 31)]);

    await expect(cleanup(ctx)).resolves.toEqual({ rawBodiesCleared: 1, metadataCleared: 0 });

    const row = rows.get('old');
    expect(storedText(row)).not.toContain('bring a hat');
    expect(row).toMatchObject({
      fromEmail: 'sender@example.com',
      subject: 'Term dates',
      processingState: 'noticeCreated',
      rawBodyClearedAt: now
    });
  });

  it('reduces the email to a bare record after 90 days, keeping its id so notices stay linked', async () => {
    const { ctx, rows } = createCtx([capturedEmail('ancient', 91)]);

    await cleanup(ctx);

    const row = rows.get('ancient');
    for (const privateValue of [
      'sender',
      'term dates',
      'household@',
      'term-dates.pdf',
      'generic reason',
      'bring a hat'
    ]) {
      expect(storedText(row)).not.toContain(privateValue);
    }
    expect(row).toMatchObject({
      _id: 'ancient',
      hasAttachments: true,
      processingState: 'noticeCreated',
      metadataClearedAt: now
    });
  });

  it('fails an email still awaiting triage, so an empty body never reaches the agent', async () => {
    const { ctx, rows } = createCtx([
      capturedEmail('pending', 31, { processingState: 'pending' }),
      capturedEmail('processing', 31, { processingState: 'processing' })
    ]);

    await cleanup(ctx);

    for (const id of ['pending', 'processing']) {
      expect(rows.get(id)).toMatchObject({
        processingState: 'failed',
        triageFailureReason: 'raw_body_expired',
        processedAt: now
      });
    }
  });

  it('waits for a live triage claim so a finished result is not discarded', async () => {
    const { ctx, rows } = createCtx([
      capturedEmail('claimed', 31, { processingState: 'processing', updatedAt: now - 1 })
    ]);

    await expect(cleanup(ctx)).resolves.toMatchObject({ rawBodiesCleared: 0 });

    expect(rows.get('claimed')).toMatchObject({ processingState: 'processing', textBody: 'Bring a hat.' });
  });

  it('removes the fingerprint with the metadata when a body backlog has not reached the row', async () => {
    const backlog = Array.from({ length: 25 }, (_, index) => capturedEmail(`backlog_${index}`, 31));
    const { ctx, rows } = createCtx([...backlog, capturedEmail('ancient', 91)]);

    await cleanup(ctx);

    expect(rows.get('ancient')).toMatchObject({ messageFingerprint: '', metadataClearedAt: now });
  });

  it('keeps the original reason on an email that had already failed', async () => {
    const { ctx, rows } = createCtx([
      capturedEmail('failed', 31, { processingState: 'failed', triageFailureReason: 'provider_failure' })
    ]);

    await cleanup(ctx);

    expect(rows.get('failed')).toMatchObject({ processingState: 'failed', triageFailureReason: 'provider_failure' });
  });

  it('does not rewrite rows that were already cleared', async () => {
    const { ctx, patchCounts } = createCtx([capturedEmail('ancient', 91)]);

    await cleanup(ctx);
    await expect(cleanup(ctx, now + day)).resolves.toEqual({ rawBodiesCleared: 0, metadataCleared: 0 });

    expect(patchCounts.get('ancient')).toBe(2);
  });

  it('works through a backlog in bounded batches', async () => {
    const emails = Array.from({ length: 30 }, (_, index) => capturedEmail(`old_${index}`, 31));
    const { ctx } = createCtx(emails);

    await expect(cleanup(ctx)).resolves.toMatchObject({ rawBodiesCleared: 25 });
    await expect(cleanup(ctx)).resolves.toMatchObject({ rawBodiesCleared: 5 });
  });

  it('lets a re-forwarded email be captured again once the earlier body is gone', async () => {
    const email: ForwardedEmailCaptureInput = {
      provider: 'resend',
      providerMessageId: 'message_new',
      receivedAt: now,
      from: { email: 'sender@example.com' },
      to: ['household@example.com'],
      subject: 'Term dates',
      textBody: 'Bring a hat.',
      hasAttachments: false,
      attachmentMetadata: []
    };
    const cleared = capturedEmail('old', 31, { messageFingerprint: '', textBody: '' });
    const insert = async () => 'capturedEmails_new';
    const lookups = {
      withIndex: (_index: string, range: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
        const applied: Array<[string, unknown]> = [];
        const builder = {
          eq: (field: string, value: unknown) => {
            applied.push([field, value]);
            return builder;
          }
        };
        range(builder);
        return {
          unique: async () => (applied.every(([field, value]) => cleared[field] === value) ? cleared : null)
        };
      }
    };
    vi.stubEnv('BOT_SERVICE_TOKEN', 'service-token');

    await expect(
      captureForwardedEmailForBotHandler({ db: { insert, query: () => lookups } } as never, {
        serviceToken: 'service-token',
        capturedAt: now,
        email
      })
    ).resolves.toEqual({ status: 'created', capturedEmailId: 'capturedEmails_new' });
    vi.unstubAllEnvs();
  });
});
