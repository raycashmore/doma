import { describe, expect, it } from 'vitest';

import { readHomeWidgetSummary } from './widgetSummary';

// Monday 13 July 2026, 5:00 pm in Sydney.
const now = new Date('2026-07-13T07:00:00.000Z');
const timeZone = 'Australia/Sydney';
const at = (iso: string) => Date.parse(iso);
const HOUR = 60 * 60 * 1000;

describe('readHomeWidgetSummary', () => {
  it('rejects signed-out callers before reading household data', async () => {
    const ctx = {
      auth: { getUserIdentity: async () => null },
      db: {
        query: () => {
          throw new Error('Private data was read before authentication');
        }
      }
    };

    await expect(readHomeWidgetSummary(ctx as never, { now, timeZone })).rejects.toThrow('Not authenticated');
  });

  it('fills every tile in a busy week', async () => {
    const ctx = createCtx({
      events: [
        event('finished', '2026-07-13T05:00:00.000Z'),
        event('dancing', '2026-07-13T08:00:00.000Z', { description: 'Studio 2\nBring water' }),
        event('requirement', '2026-07-13T07:30:00.000Z', { kind: 'dailyRequirements' }),
        event('holiday', '2026-07-14T14:00:00.000Z', { allDay: true, end: at('2026-07-15T14:00:00.000Z') }),
        event('swimming', '2026-07-14T22:00:00.000Z'),
        event('dentist', '2026-07-15T23:00:00.000Z'),
        event('soccer', '2026-07-17T23:00:00.000Z'),
        event('next-week', '2026-07-20T08:00:00.000Z')
      ],
      lists: [shoppingList],
      listItems: [listItem('milk'), listItem('bread'), listItem('eggs', { completedAt: 5 })],
      manualNotes: [manualNote('note_bins', { title: 'Bins out Thursday' })]
    });

    const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

    expect(summary.localDate).toBe('2026-07-13');
    expect(summary.thisWeek.events[0]).toEqual({
      id: `calendar:dancing:${at('2026-07-13T08:00:00.000Z')}`,
      title: 'Event dancing',
      detail: 'Studio 2',
      start: at('2026-07-13T08:00:00.000Z'),
      end: at('2026-07-13T08:00:00.000Z') + HOUR,
      allDay: false
    });
    expect(summary.thisWeek.events.map((row) => row.title)).toEqual([
      'Event dancing',
      'Event holiday',
      'Event swimming',
      'Event dentist',
      'Event soccer'
    ]);
    expect(summary.list).toEqual({ publicId: 'list_shopping', name: 'Shopping list', activeCount: 2 });
    expect(summary.note).toEqual({ kind: 'manualNote', id: 'note_bins', title: 'Bins out Thursday', dueState: 'none' });
  });

  it('sends events in start order, all-day ones included, for the widget to choose Next from', async () => {
    const ctx = createCtx({
      events: [
        event('holiday-today', '2026-07-12T14:00:00.000Z', { allDay: true, end: at('2026-07-13T14:00:00.000Z') }),
        event('pickup', '2026-07-13T08:00:00.000Z')
      ]
    });

    const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

    expect(summary.thisWeek.events.map((row) => row.title)).toEqual(['Event holiday-today', 'Event pickup']);
  });

  it('keeps an event that has started until it finishes', async () => {
    const ctx = createCtx({ events: [event('in-progress', '2026-07-13T06:30:00.000Z')] });

    const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

    expect(summary.thisWeek.events.map((row) => row.title)).toEqual(['Event in-progress']);
  });

  it('sends daily requirements for the next two days on their own, apart from the week', async () => {
    const ctx = createCtx({
      events: [
        event('done', '2026-07-12T22:00:00.000Z', { kind: 'dailyRequirements' }),
        event('sport', '2026-07-13T22:00:00.000Z', { kind: 'dailyRequirements', title: 'Child A: Sport day' }),
        event('library', '2026-07-13T22:00:00.000Z', { kind: 'dailyRequirements', title: 'Child B: Library bag' }),
        event('all-day', '2026-07-13T14:00:00.000Z', { kind: 'dailyRequirements', allDay: true }),
        event('later', '2026-07-15T22:00:00.000Z', { kind: 'dailyRequirements' }),
        event('drop-off', '2026-07-13T22:30:00.000Z')
      ]
    });

    const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

    expect(summary.requirements.map((row) => row.title)).toEqual(['Child B: Library bag', 'Child A: Sport day']);
    expect(summary.thisWeek.events.map((row) => row.title)).toEqual(['Event drop-off']);
  });

  it('sends the one event of a quiet week', async () => {
    const ctx = createCtx({
      events: [event('swimming', '2026-07-15T22:00:00.000Z')],
      lists: [shoppingList],
      listItems: []
    });

    const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

    expect(summary.thisWeek.events.map((row) => row.title)).toEqual(['Event swimming']);
    expect(summary.list?.activeCount).toBe(0);
    expect(summary.note).toBeNull();
  });

  it('has no events when nothing is booked, while the list and note still show', async () => {
    const ctx = createCtx({
      events: [event('next-week', '2026-07-21T08:00:00.000Z')],
      lists: [shoppingList],
      listItems: [listItem('milk')],
      manualNotes: [manualNote('note_form')]
    });

    const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

    expect(summary.thisWeek).toEqual({ events: [] });
    expect(summary.list?.activeCount).toBe(1);
    expect(summary.note?.id).toBe('note_form');
  });

  it('is all clear with nothing booked, listed or noted', async () => {
    const ctx = createCtx({
      events: [event('requirement', '2026-07-14T08:00:00.000Z', { kind: 'dailyRequirements' })],
      emailNotices: [emailNotice('notice_undated')]
    });

    await expect(readHomeWidgetSummary(ctx as never, { now, timeZone })).resolves.toEqual({
      localDate: '2026-07-13',
      thisWeek: { events: [] },
      requirements: [expect.objectContaining({ title: 'Event requirement' })],
      list: null,
      note: null
    });
  });

  it('shows the chosen Groceries list in place of the shared Shopping list', async () => {
    const chosen = { ...shoppingList, _id: 'list_chosen', publicId: 'list_chosen', name: 'Weekly shop' };
    const ctx = createCtx({
      lists: [shoppingList, chosen],
      groceriesDefault: { userId: 'user_a', listId: 'list_chosen' },
      listItems: [listItem('milk'), listItem('rice', { listId: 'list_chosen' })]
    });

    const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

    expect(summary.list).toEqual({ publicId: 'list_chosen', name: 'Weekly shop', activeCount: 1 });
  });

  describe('note tile', () => {
    it('ranks notes and dated email notices by how soon they are due', async () => {
      const ctx = createCtx({
        manualNotes: [manualNote('note_friday', { dueDate: '2026-07-17' }), manualNote('note_undated')],
        emailNotices: [
          emailNotice('notice_today', { dueOn: '2026-07-13' }),
          emailNotice('notice_overdue_archived', { dueOn: '2026-07-10', archivedAt: 1 })
        ]
      });

      const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

      expect(summary.note).toEqual({
        kind: 'emailNotice',
        id: 'notice_today',
        title: 'Notice notice_today',
        dueDate: '2026-07-13',
        dueState: 'dueToday'
      });
    });

    it('puts an overdue item ahead of one due today', async () => {
      const ctx = createCtx({
        manualNotes: [manualNote('note_today', { dueDate: '2026-07-13' })],
        emailNotices: [emailNotice('notice_overdue', { dueOn: '2026-07-10' })]
      });

      const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

      expect(summary.note).toMatchObject({ id: 'notice_overdue', dueState: 'overdue' });
    });

    it('prefers a note over an email notice due the same day, then the newest', async () => {
      const ctx = createCtx({
        manualNotes: [
          manualNote('note_older', { dueDate: '2026-07-14', updatedAt: 1 }),
          manualNote('note_newer', { dueDate: '2026-07-14', updatedAt: 2 })
        ],
        emailNotices: [emailNotice('notice_same_day', { dueOn: '2026-07-14', createdAt: 3 })]
      });

      const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

      expect(summary.note?.id).toBe('note_newer');
    });

    it('leaves out notes and notices archived from the board, and expired or undated notices', async () => {
      const ctx = createCtx({
        manualNotes: [manualNote('note_archived', { dueDate: '2026-07-13' })],
        emailNotices: [
          emailNotice('notice_expired', { dueOn: '2026-07-13', expiresAt: now.getTime() - 1 }),
          emailNotice('notice_board_archived', { dueOn: '2026-07-13' }),
          emailNotice('notice_undated'),
          emailNotice('notice_later', { dueOn: '2026-07-30' })
        ],
        boardArchives: ['manualNote:note_archived', 'emailNotice:notice_board_archived']
      });

      const summary = await readHomeWidgetSummary(ctx as never, { now, timeZone });

      expect(summary.note?.id).toBe('notice_later');
    });
  });
});

const shoppingList = {
  _id: 'list_shopping',
  publicId: 'list_shopping',
  name: 'Shopping list',
  slug: 'shopping-list',
  visibility: 'shared' as const,
  createdByUserId: 'user_b',
  createdAt: 1,
  updatedAt: 1
};

function event(id: string, startIso: string, overrides: Record<string, unknown> = {}) {
  const start = at(startIso);
  return {
    googleEventId: id,
    calendarId: 'calendar',
    start,
    end: start + HOUR,
    allDay: false,
    title: `Event ${id}`,
    who: [],
    recurring: false,
    htmlLink: `https://calendar.example.test/${id}`,
    ...overrides
  };
}

function listItem(id: string, overrides: Record<string, unknown> = {}) {
  return { _id: id, listId: 'list_shopping', title: id, sortOrder: 1, createdAt: 1, updatedAt: 1, ...overrides };
}

function manualNote(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    title: `Note ${id}`,
    authorUserId: 'user_b',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

function emailNotice(id: string, { dueOn, ...overrides }: { dueOn?: string } & Record<string, unknown> = {}) {
  return {
    _id: id,
    title: `Notice ${id}`,
    body: 'Body',
    priority: 'medium',
    obligation: dueOn ? { action: 'Reply', dueOn } : null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

type Rows = {
  events?: ReturnType<typeof event>[];
  lists?: (typeof shoppingList)[];
  listItems?: ReturnType<typeof listItem>[];
  groceriesDefault?: { userId: string; listId: string };
  manualNotes?: ReturnType<typeof manualNote>[];
  emailNotices?: ReturnType<typeof emailNotice>[];
  boardArchives?: string[];
};

function createCtx(rows: Rows) {
  const tables: Record<string, Record<string, unknown>[]> = {
    scheduleEvents: rows.events ?? [],
    lists: rows.lists ?? [],
    listItems: rows.listItems ?? [],
    groceriesListDefaults: rows.groceriesDefault ? [rows.groceriesDefault] : [],
    manualNotes: rows.manualNotes ?? [],
    emailNotices: rows.emailNotices ?? [],
    boardArchives: (rows.boardArchives ?? []).map((occurrenceId) => ({ occurrenceId }))
  };

  return {
    auth: { getUserIdentity: async () => ({ subject: 'user_a' }) },
    db: {
      get: async (id: string) =>
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null,
      query: (table: string) => {
        const all = tables[table] ?? [];
        return {
          collect: async () => all,
          withIndex: (
            _index: string,
            apply: (q: Record<'eq' | 'lt', (field: string, value: unknown) => unknown>) => unknown
          ) => {
            const filters: ((row: Record<string, unknown>) => boolean)[] = [];
            const builder = {
              eq: (field: string, value: unknown) => {
                filters.push((row) => row[field] === value);
                return builder;
              },
              lt: (field: string, value: unknown) => {
                filters.push((row) => (row[field] as number) < (value as number));
                return builder;
              }
            };
            apply(builder);
            const matching = all.filter((row) => filters.every((filter) => filter(row)));
            return { collect: async () => matching, unique: async () => matching[0] ?? null };
          }
        };
      }
    }
  };
}
