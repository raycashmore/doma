import { afterEach, describe, expect, it, vi } from 'vitest';

import { archiveBoardItemHandler, type BoardSourceKind } from './archives';

afterEach(() => vi.restoreAllMocks());

function createCtx(identity: { subject: string } | null, existing: Record<string, unknown> | null = null) {
  const inserted: Record<string, unknown>[] = [];
  return {
    ctx: {
      auth: { getUserIdentity: async () => identity },
      db: {
        insert: async (table: string, row: Record<string, unknown>) => {
          expect(table).toBe('boardArchives');
          inserted.push(row);
          return 'archive_new';
        },
        query: (table: string) => {
          expect(table).toBe('boardArchives');
          return {
            withIndex: (
              index: string,
              apply: (query: { eq: (field: string, value: string) => unknown }) => unknown
            ) => {
              expect(index).toBe('by_occurrence_id');
              apply({
                eq: (field, value) => {
                  expect(field).toBe('occurrenceId');
                  return value;
                }
              });
              return { unique: async () => existing };
            }
          };
        }
      }
    },
    inserted
  };
}

const kinds: BoardSourceKind[] = ['today', 'meals', 'forwardedEmail', 'monthlySpendingInsight', 'manualNote'];

describe('archiveBoardItemHandler', () => {
  it('rejects signed-out callers before reading or writing household data', async () => {
    await expect(
      archiveBoardItemHandler(createCtx(null).ctx as never, { occurrenceId: 'today:2026-07-14', sourceKind: 'today' })
    ).rejects.toThrow('Not authenticated');
  });

  it.each(kinds)('stores a payload-free %s occurrence archive for the household', async (sourceKind) => {
    const occurrenceId = `${sourceKind}:occurrence-1`;
    const { ctx, inserted } = createCtx({ subject: 'user_2' });
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const readBoard = vi.fn().mockResolvedValue({ items: [{ id: occurrenceId, sourceKind }] });

    await expect(
      archiveBoardItemHandler(ctx as never, { occurrenceId, sourceKind }, { readBoard, timeZone: 'Australia/Sydney' })
    ).resolves.toMatchObject({ _id: 'archive_new', occurrenceId, sourceKind });

    expect(inserted).toEqual([{ occurrenceId, sourceKind, archivedByUserId: 'user_2', archivedAt: 1_700_000_000_000 }]);
  });

  it('returns the existing archive for an idempotent duplicate attempt', async () => {
    const existing = {
      _id: 'archive_existing',
      occurrenceId: 'manualNote:note_1',
      sourceKind: 'manualNote',
      archivedByUserId: 'user_1',
      archivedAt: 1
    };
    const { ctx, inserted } = createCtx({ subject: 'user_2' }, existing);
    const readBoard = vi.fn();

    await expect(
      archiveBoardItemHandler(
        ctx as never,
        { occurrenceId: existing.occurrenceId, sourceKind: 'manualNote' },
        { readBoard, timeZone: 'Australia/Sydney' }
      )
    ).resolves.toEqual(existing);
    expect(readBoard).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
  });

  it('does not let a caller pre-archive a future or mismatched occurrence', async () => {
    const { ctx } = createCtx({ subject: 'user_1' });
    const readBoard = vi.fn().mockResolvedValue({
      items: [{ id: 'today:2026-07-14', sourceKind: 'today' }]
    });

    await expect(
      archiveBoardItemHandler(
        ctx as never,
        { occurrenceId: 'today:2026-07-15', sourceKind: 'today' },
        { readBoard, timeZone: 'Australia/Sydney' }
      )
    ).rejects.toThrow('Board item unavailable');
    await expect(
      archiveBoardItemHandler(
        ctx as never,
        { occurrenceId: 'today:2026-07-14', sourceKind: 'meals' },
        { readBoard, timeZone: 'Australia/Sydney' }
      )
    ).rejects.toThrow('Board item unavailable');
  });
});
