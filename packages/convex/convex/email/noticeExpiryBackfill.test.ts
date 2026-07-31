import { describe, expect, it } from 'vitest';

import { backfillMissingEmailNoticeExpiries } from './noticeExpiryBackfill';

type NoticeRow = Record<string, unknown> & { _id: string; createdAt: number };

function createCtx(notices: NoticeRow[]) {
  const rows = Object.fromEntries(notices.map((notice) => [notice._id, notice]));
  return {
    ctx: {
      db: {
        query: (table: 'emailNotices') => ({
          withIndex: (
            _name: string,
            range: (query: { eq: (field: string, value: unknown) => { field: string; value: unknown } }) => {
              field: string;
              value: unknown;
            }
          ) => {
            const { field, value } = range({
              eq: (indexField, indexValue) => ({ field: indexField, value: indexValue })
            });
            return {
              take: async (limit: number) =>
                table === 'emailNotices'
                  ? Object.values(rows)
                      .filter((notice) => notice[field] === value)
                      .slice(0, limit)
                  : []
            };
          }
        }),
        patch: async (id: string, value: Record<string, unknown>) => Object.assign(rows[id] ?? {}, value)
      }
    },
    rows
  };
}

function missingNotice(id: string, overrides: Record<string, unknown> = {}): NoticeRow {
  return {
    _id: id,
    createdAt: Date.parse('2026-07-21T02:00:00.000Z'),
    ...overrides
  };
}

describe('backfillMissingEmailNoticeExpiries', () => {
  it('backfills a grounded obligation for one complete overdue day', async () => {
    const { ctx, rows } = createCtx([
      missingNotice('email_notice', {
        obligation: {
          action: 'Complete required action',
          dueOn: '2026-07-31',
          dueDateConfidence: 'high',
          dueDateEvidence: 'Due-date evidence.'
        }
      })
    ]);

    await backfillMissingEmailNoticeExpiries(ctx as never);

    expect(rows.email_notice).toMatchObject({
      expiresAt: Date.parse('2026-08-01T14:00:00.000Z')
    });
  });

  it('uses the fourteen-date fallback for undated and low-confidence notices', async () => {
    const { ctx, rows } = createCtx([
      missingNotice('email_notice_undated'),
      missingNotice('email_notice_low_confidence', {
        obligation: {
          action: 'Complete required action',
          dueOn: '2026-07-31',
          dueDateConfidence: 'low',
          dueDateEvidence: 'Uncertain date evidence.'
        }
      })
    ]);

    await backfillMissingEmailNoticeExpiries(ctx as never);

    expect(rows.email_notice_undated).toMatchObject({ expiresAt: Date.parse('2026-08-03T14:00:00.000Z') });
    expect(rows.email_notice_low_confidence).toMatchObject({ expiresAt: Date.parse('2026-08-03T14:00:00.000Z') });
  });

  it('leaves existing expiry and supersession lifecycle fields unchanged', async () => {
    const existingExpiresAt = Date.parse('2026-08-10T14:00:00.000Z');
    const existingSupersededAt = Date.parse('2026-07-22T02:00:00.000Z');
    const { ctx, rows } = createCtx([
      missingNotice('email_notice_existing_expiry', { expiresAt: existingExpiresAt }),
      missingNotice('email_notice_superseded', { supersededAt: existingSupersededAt })
    ]);

    await backfillMissingEmailNoticeExpiries(ctx as never);

    expect(rows.email_notice_existing_expiry).toMatchObject({ expiresAt: existingExpiresAt });
    expect(rows.email_notice_superseded).toMatchObject({
      expiresAt: Date.parse('2026-08-03T14:00:00.000Z'),
      supersededAt: existingSupersededAt
    });
  });

  it('patches a default batch of one hundred and is retry-safe after completion', async () => {
    const { ctx, rows } = createCtx(Array.from({ length: 101 }, (_, index) => missingNotice(`email_notice_${index}`)));

    await expect(backfillMissingEmailNoticeExpiries(ctx as never)).resolves.toEqual({ patched: 100, hasMore: true });
    await expect(backfillMissingEmailNoticeExpiries(ctx as never)).resolves.toEqual({ patched: 1, hasMore: false });
    await expect(backfillMissingEmailNoticeExpiries(ctx as never)).resolves.toEqual({ patched: 0, hasMore: false });
    expect(Object.values(rows).every((notice) => notice.expiresAt !== undefined)).toBe(true);
  });

  it('uses the missing-expiry index and reads only one bounded matching batch on each retry', async () => {
    const rows = Object.fromEntries([
      ...Array.from({ length: 1_000 }, (_, index) => [
        `email_notice_current_${index}`,
        missingNotice(`email_notice_current_${index}`, { expiresAt: index })
      ]),
      ...Array.from({ length: 3 }, (_, index) => [
        `email_notice_legacy_${index}`,
        missingNotice(`email_notice_legacy_${index}`)
      ])
    ]) as Record<string, NoticeRow>;
    const indexRanges: Array<{ name: string; field: string; value: unknown }> = [];
    const takeLimits: number[] = [];
    const ctx = {
      db: {
        query: (table: 'emailNotices') => ({
          withIndex: (
            name: string,
            range: (query: { eq: (field: string, value: unknown) => { field: string; value: unknown } }) => {
              field: string;
              value: unknown;
            }
          ) => {
            const { field, value } = range({
              eq: (indexField, indexValue) => ({ field: indexField, value: indexValue })
            });
            indexRanges.push({ name, field, value });
            return {
              take: async (limit: number) => {
                takeLimits.push(limit);
                return table === 'emailNotices'
                  ? Object.values(rows)
                      .filter((notice) => notice.expiresAt === undefined)
                      .slice(0, limit)
                  : [];
              }
            };
          }
        }),
        patch: async (id: string, value: Record<string, unknown>) => Object.assign(rows[id] ?? {}, value)
      }
    };

    await expect(backfillMissingEmailNoticeExpiries(ctx as never, { batchSize: 2 })).resolves.toEqual({
      patched: 2,
      hasMore: true
    });
    await expect(backfillMissingEmailNoticeExpiries(ctx as never, { batchSize: 2 })).resolves.toEqual({
      patched: 1,
      hasMore: false
    });
    await expect(backfillMissingEmailNoticeExpiries(ctx as never, { batchSize: 2 })).resolves.toEqual({
      patched: 0,
      hasMore: false
    });

    expect(indexRanges).toEqual([
      { name: 'by_expires_at', field: 'expiresAt', value: undefined },
      { name: 'by_expires_at', field: 'expiresAt', value: undefined },
      { name: 'by_expires_at', field: 'expiresAt', value: undefined }
    ]);
    expect(takeLimits).toEqual([3, 3, 3]);
  });
});
