import { afterEach, describe, expect, it, vi } from 'vitest';

import { createManualNoteHandler, updateManualNoteHandler } from './manualNotes';

afterEach(() => vi.restoreAllMocks());

type ManualNoteRow = {
  _id: string;
  title: string;
  detail?: string;
  dueDate?: string;
  authorUserId: string;
  createdAt: number;
  updatedAt: number;
};

function createCtx(identity: { subject: string } | null, rows: ManualNoteRow[] = []) {
  const inserted: Record<string, unknown>[] = [];
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];

  return {
    ctx: {
      auth: { getUserIdentity: async () => identity },
      db: {
        insert: async (table: string, row: Record<string, unknown>) => {
          expect(table).toBe('manualNotes');
          inserted.push(row);
          return 'manual_note_new';
        },
        get: async (id: string) => rows.find((row) => row._id === id) ?? null,
        patch: async (id: string, patch: Record<string, unknown>) => patches.push({ id, patch })
      }
    },
    inserted,
    patches
  };
}

describe('manual note mutations', () => {
  it('rejects signed-out callers and invalid titles', async () => {
    await expect(createManualNoteHandler(createCtx(null).ctx as never, { title: 'A note' })).rejects.toThrow(
      'Not authenticated'
    );
    await expect(
      createManualNoteHandler(createCtx({ subject: 'user_1' }).ctx as never, {
        title: '   ',
        detail: 'Keep this entered detail',
        dueDate: '2026-07-20'
      })
    ).rejects.toThrow('Title is required');
  });

  it('stores trimmed required and optional fields with authorship and timestamps', async () => {
    const { ctx, inserted } = createCtx({ subject: 'user_1' });
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    await expect(
      createManualNoteHandler(ctx as never, {
        title: '  Return library books  ',
        detail: '  Leave them by the door.  ',
        dueDate: '2026-07-20'
      })
    ).resolves.toMatchObject({ _id: 'manual_note_new', title: 'Return library books' });

    expect(inserted).toEqual([
      {
        title: 'Return library books',
        detail: 'Leave them by the door.',
        dueDate: '2026-07-20',
        authorUserId: 'user_1',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000
      }
    ]);
  });

  it('omits blank optional fields and permits another household user to edit', async () => {
    const existing: ManualNoteRow = {
      _id: 'manual_note_1',
      title: 'Old title',
      detail: 'Old detail',
      dueDate: '2026-07-20',
      authorUserId: 'user_1',
      createdAt: 1,
      updatedAt: 1
    };
    const { ctx, patches } = createCtx({ subject: 'user_2' }, [existing]);
    vi.spyOn(Date, 'now').mockReturnValue(2_000);

    await updateManualNoteHandler(ctx as never, {
      noteId: 'manual_note_1' as never,
      title: '  Shared update ',
      detail: ' ',
      dueDate: undefined
    });

    expect(patches).toEqual([
      {
        id: 'manual_note_1',
        patch: { title: 'Shared update', detail: undefined, dueDate: undefined, updatedAt: 2_000 }
      }
    ]);
  });

  it('rejects malformed household-local due dates', async () => {
    await expect(
      createManualNoteHandler(createCtx({ subject: 'user_1' }).ctx as never, {
        title: 'A note',
        dueDate: '2026-02-30'
      })
    ).rejects.toThrow('Due date is invalid');
  });
});
