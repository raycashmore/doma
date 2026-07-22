import { describe, expect, it } from 'vitest';

import { readActiveBoard } from './activeBoard';

describe('readActiveBoard', () => {
  it('rejects signed-out callers before reading private household data', async () => {
    const ctx = {
      auth: { getUserIdentity: async () => null },
      db: {
        query: () => {
          throw new Error('Private data was read before authentication');
        }
      }
    };

    await expect(
      readActiveBoard(ctx as never, {
        now: new Date('2026-07-13T22:00:00.000Z'),
        timeZone: 'Australia/Sydney'
      })
    ).rejects.toThrow('Not authenticated');
  });

  it('returns Today then Today’s Meals from canonical records in the household timezone', async () => {
    const now = new Date('2026-07-13T22:00:00.000Z');
    const briefing = {
      briefingKey: 'morning:2026-07-14',
      briefingKind: 'morning' as const,
      localDate: '2026-07-14',
      generationStatus: 'ai' as const,
      generatedAt: Date.parse('2026-07-13T21:35:00.000Z'),
      message: 'Tuesday ready',
      briefing: {
        shouldSend: true,
        headline: 'Tuesday ready',
        morning: [
          {
            text: 'Bring library bag',
            who: ['memberA'],
            sourceIds: ['requirements-calendar:library-bag:1783951200000']
          }
        ],
        afternoon: [
          {
            text: 'Bring sports bag',
            who: ['memberB'],
            sourceIds: ['requirements-calendar:sport-kit:1783985400000']
          }
        ],
        watchouts: [
          {
            text: 'Signed form due tomorrow',
            who: [],
            sourceIds: ['requirements-calendar:signed-form:1783951200000']
          }
        ],
        sourceIdsIgnored: []
      },
      sourceIds: [
        'requirements-calendar:library-bag:1783951200000',
        'requirements-calendar:sport-kit:1783985400000',
        'requirements-calendar:signed-form:1783951200000'
      ]
    };
    const upcomingEvent = {
      googleEventId: 'sport-kit',
      calendarId: 'requirements-calendar',
      start: Date.parse('2026-07-13T23:30:00.000Z'),
      end: Date.parse('2026-07-14T00:00:00.000Z'),
      allDay: false,
      title: 'Bring sports bag',
      kind: 'dailyRequirements' as const,
      description: 'Pack it before leaving.',
      who: ['memberB'],
      recurring: false,
      htmlLink: 'https://calendar.example.test/event/sport-kit'
    };
    const expiredEvent = {
      ...upcomingEvent,
      googleEventId: 'early-start',
      start: Date.parse('2026-07-13T20:00:00.000Z'),
      end: Date.parse('2026-07-13T21:00:00.000Z'),
      title: 'Leave early'
    };
    const allDayEvent = {
      ...upcomingEvent,
      googleEventId: 'library-bag',
      start: Date.parse('2026-07-13T14:00:00.000Z'),
      end: Date.parse('2026-07-14T14:00:00.000Z'),
      allDay: true,
      title: 'Bring library bag'
    };
    const watchoutEvent = {
      ...allDayEvent,
      googleEventId: 'signed-form',
      title: 'Signed form due tomorrow'
    };
    const unrelatedRequirement = {
      ...upcomingEvent,
      googleEventId: 'unselected-requirement',
      title: 'Unselected requirement'
    };
    const plan = {
      weekStart: '2026-07-13',
      assignments: [{ day: 'tuesday' as const, meal: 'schoolLunch' as const, recipePublicId: 'recipe_pasta' }],
      updatedByUserId: 'user_123',
      createdAt: 1,
      updatedAt: 2
    };
    const recipe = {
      publicId: 'recipe_pasta',
      name: 'Pasta salad'
    };
    const ctx = createActiveBoardCtx({
      briefing,
      events: [expiredEvent, allDayEvent, watchoutEvent, upcomingEvent, unrelatedRequirement],
      plan,
      recipes: [recipe]
    });

    await expect(readActiveBoard(ctx as never, { now, timeZone: 'Australia/Sydney' })).resolves.toEqual({
      localDate: '2026-07-14',
      timeZone: 'Australia/Sydney',
      items: [
        {
          kind: 'today',
          id: 'today:2026-07-14',
          sourceKind: 'today',
          sourceApp: 'schedule',
          destination: '/schedule',
          briefingStatus: 'available',
          headline: 'Tuesday ready',
          generatedAt: briefing.generatedAt,
          morning: briefing.briefing.morning,
          laterToday: [
            {
              id: `requirements-calendar:sport-kit:${upcomingEvent.start}`,
              title: 'Bring sports bag',
              start: upcomingEvent.start,
              end: upcomingEvent.end,
              allDay: false,
              who: ['memberB'],
              destination: '/schedule'
            }
          ],
          watchouts: briefing.briefing.watchouts
        },
        {
          kind: 'meals',
          id: 'meals:2026-07-14',
          sourceKind: 'meals',
          sourceApp: 'meals',
          destination: '/meals',
          schoolLunch: 'Pasta salad',
          dinner: 'Not planned'
        }
      ]
    });
  });

  it('keeps both cards explicit when the briefing and meal assignments are missing', async () => {
    const ctx = createActiveBoardCtx({ briefing: null, events: [], plan: null, recipes: [] });

    const result = await readActiveBoard(ctx as never, {
      now: new Date('2026-07-18T22:30:00.000Z'),
      timeZone: 'Australia/Sydney'
    });

    expect(result.items).toEqual([
      {
        kind: 'today',
        id: 'today:2026-07-19',
        sourceKind: 'today',
        sourceApp: 'schedule',
        destination: '/schedule',
        briefingStatus: 'missing',
        headline: 'Today',
        generatedAt: null,
        morning: [],
        laterToday: [],
        watchouts: []
      },
      {
        kind: 'meals',
        id: 'meals:2026-07-19',
        sourceKind: 'meals',
        sourceApp: 'meals',
        destination: '/meals',
        schoolLunch: 'Not planned',
        dinner: 'Not planned'
      }
    ]);
  });

  it('returns an explicit empty state for a stored briefing with nothing to surface', async () => {
    const emptyBriefing = {
      briefingKey: 'morning:2026-07-19',
      briefingKind: 'morning' as const,
      localDate: '2026-07-19',
      generationStatus: 'deterministic' as const,
      generatedAt: 1,
      message: '',
      briefing: {
        shouldSend: false,
        headline: 'Quiet morning',
        morning: [],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      },
      sourceIds: []
    };
    const ctx = createActiveBoardCtx({ briefing: emptyBriefing, events: [], plan: null, recipes: [] });

    const result = await readActiveBoard(ctx as never, {
      now: new Date('2026-07-18T22:30:00.000Z'),
      timeZone: 'Australia/Sydney'
    });

    expect(result.items[0]).toMatchObject({
      kind: 'today',
      briefingStatus: 'empty',
      morning: [],
      laterToday: [],
      watchouts: []
    });
  });

  it('surfaces canonical email notices and only the latest current monthly spending insight', async () => {
    const ctx = createActiveBoardCtx({
      briefing: null,
      events: [],
      plan: null,
      recipes: [],
      emailNotices: [
        {
          _id: 'emailNotices_quiet',
          capturedEmailId: 'capturedEmails_quiet',
          category: 'admin',
          priority: 'low',
          title: 'Library opening hours changed',
          body: 'The household collection window has moved.',
          extractedFacts: [],
          telegramWorthy: false,
          createdAt: Date.parse('2026-07-10T02:00:00.000Z'),
          updatedAt: Date.parse('2026-07-10T02:00:00.000Z')
        },
        {
          _id: 'emailNotices_urgent',
          capturedEmailId: 'capturedEmails_urgent',
          category: 'school',
          priority: 'high',
          title: 'Permission form due',
          body: 'Return the form before Friday.',
          extractedFacts: [{ label: 'due', value: 'Friday' }],
          telegramWorthy: true,
          obligation: {
            action: 'Return the permission form',
            dueOn: '2026-07-17',
            dueDateConfidence: 'high',
            dueDateEvidence: 'The form is due Friday.'
          },
          createdAt: Date.parse('2026-07-11T02:00:00.000Z'),
          updatedAt: Date.parse('2026-07-11T02:00:00.000Z')
        },
        {
          _id: 'emailNotices_archived',
          capturedEmailId: 'capturedEmails_archived',
          category: 'other',
          priority: 'medium',
          title: 'Superseded notice',
          body: 'This occurrence is no longer current.',
          extractedFacts: [],
          telegramWorthy: true,
          createdAt: Date.parse('2026-07-12T02:00:00.000Z'),
          updatedAt: Date.parse('2026-07-12T02:00:00.000Z'),
          archivedAt: Date.parse('2026-07-12T03:00:00.000Z')
        },
        {
          _id: 'emailNotices_expired',
          capturedEmailId: 'capturedEmails_expired',
          category: 'admin',
          priority: 'medium',
          title: 'Expired notice',
          body: 'This occurrence has passed its relevance window.',
          extractedFacts: [],
          telegramWorthy: false,
          createdAt: Date.parse('2026-07-01T02:00:00.000Z'),
          updatedAt: Date.parse('2026-07-01T02:00:00.000Z'),
          expiresAt: Date.parse('2026-07-13T21:00:00.000Z')
        },
        {
          _id: 'emailNotices_superseded',
          capturedEmailId: 'capturedEmails_superseded',
          category: 'school',
          priority: 'high',
          title: 'Superseded notice',
          body: 'A newer canonical occurrence replaced this one.',
          extractedFacts: [],
          telegramWorthy: true,
          createdAt: Date.parse('2026-07-09T02:00:00.000Z'),
          updatedAt: Date.parse('2026-07-09T02:00:00.000Z'),
          supersededAt: Date.parse('2026-07-10T02:00:00.000Z')
        }
      ],
      spendingInsights: [
        spendingInsight('2026-05'),
        spendingInsight('2026-06', { headline: 'June spending settled' }),
        spendingInsight('2026-08', { headline: 'Future data must not surface' })
      ]
    });

    const result = await readActiveBoard(ctx as never, {
      now: new Date('2026-07-13T22:00:00.000Z'),
      timeZone: 'Australia/Sydney'
    });

    expect(result.items.slice(2)).toEqual([
      {
        kind: 'sourceNotice',
        id: 'emailNotice:emailNotices_urgent',
        sourceKind: 'forwardedEmail',
        sourceApp: 'home',
        display: 'wide',
        priority: 'high',
        title: 'Permission form due',
        detail: 'Return the form before Friday.',
        facts: [{ label: 'due', value: 'Friday' }],
        dueDate: '2026-07-17',
        dueState: 'upcoming',
        obligationAction: 'Return the permission form',
        occurredAt: Date.parse('2026-07-11T02:00:00.000Z'),
        destination: '/notices/emailNotices_urgent'
      },
      {
        kind: 'sourceNotice',
        id: 'emailNotice:emailNotices_quiet',
        sourceKind: 'forwardedEmail',
        sourceApp: 'home',
        display: 'compact',
        priority: 'low',
        title: 'Library opening hours changed',
        detail: 'The household collection window has moved.',
        facts: [],
        occurredAt: Date.parse('2026-07-10T02:00:00.000Z'),
        destination: '/notices/emailNotices_quiet'
      },
      {
        kind: 'sourceNotice',
        id: 'spendingInsight:2026-06',
        sourceKind: 'monthlySpendingInsight',
        sourceApp: 'budget',
        display: 'standard',
        priority: 'medium',
        title: 'June spending settled',
        detail: 'Groceries drifted upward while dining out fell.',
        occurredAt: 1_700_000_000_000,
        period: '2026-06',
        destination: '/budget'
      }
    ]);
  });

  it('surfaces shared notes live with household-local due states and keeps overdue notes active', async () => {
    const ctx = createActiveBoardCtx({
      briefing: null,
      events: [],
      plan: null,
      recipes: [],
      manualNotes: [
        manualNote('overdue', '2026-07-13'),
        manualNote('today', '2026-07-14'),
        manualNote('upcoming', '2026-07-16'),
        manualNote('undated')
      ]
    });

    const result = await readActiveBoard(ctx as never, {
      now: new Date('2026-07-13T22:00:00.000Z'),
      timeZone: 'Australia/Sydney'
    });

    expect(result.items.slice(2)).toEqual([
      expect.objectContaining({ id: 'manualNote:overdue', dueState: 'overdue', priority: 'high' }),
      expect.objectContaining({ id: 'manualNote:today', dueState: 'dueToday', priority: 'medium' }),
      expect.objectContaining({ id: 'manualNote:upcoming', dueState: 'upcoming', priority: 'low' }),
      expect.objectContaining({ id: 'manualNote:undated', dueState: 'none', priority: 'low' })
    ]);
  });

  it('suppresses archived occurrences of every card kind without suppressing a new source occurrence', async () => {
    const ctx = createActiveBoardCtx({
      briefing: null,
      events: [],
      plan: null,
      recipes: [],
      manualNotes: [manualNote('overdue', '2026-07-13')],
      emailNotices: [
        {
          _id: 'email_old',
          priority: 'low',
          title: 'Old occurrence',
          body: 'Archived',
          extractedFacts: [],
          createdAt: 1,
          updatedAt: 1
        },
        {
          _id: 'email_new',
          priority: 'low',
          title: 'New occurrence',
          body: 'Still active',
          extractedFacts: [],
          createdAt: 2,
          updatedAt: 2
        }
      ],
      spendingInsights: [spendingInsight('2026-06')],
      boardArchives: [
        boardArchive('today:2026-07-14', 'today'),
        boardArchive('meals:2026-07-14', 'meals'),
        boardArchive('manualNote:overdue', 'manualNote'),
        boardArchive('emailNotice:email_old', 'forwardedEmail'),
        boardArchive('spendingInsight:2026-06', 'monthlySpendingInsight')
      ]
    });

    const result = await readActiveBoard(ctx as never, {
      now: new Date('2026-07-13T22:00:00.000Z'),
      timeZone: 'Australia/Sydney'
    });

    expect(result.items).toEqual([
      expect.objectContaining({ id: 'emailNotice:email_new', sourceKind: 'forwardedEmail' })
    ]);
  });

  it('removes a generated line when any of its source events has been superseded', async () => {
    const currentEvent = scheduleEvent({ googleEventId: 'still-current' });
    const briefing = morningBriefing({
      morning: [
        {
          text: 'Bring both bags',
          who: [],
          sourceIds: [
            `family-calendar:${currentEvent.googleEventId}:${currentEvent.start}`,
            'family-calendar:superseded:1783983600000'
          ]
        }
      ]
    });
    const ctx = createActiveBoardCtx({ briefing, events: [currentEvent], plan: null, recipes: [] });

    const result = await readActiveBoard(ctx as never, {
      now: new Date('2026-07-13T22:00:00.000Z'),
      timeZone: 'Australia/Sydney'
    });

    expect(result.items[0]).toMatchObject({ kind: 'today', morning: [] });
  });

  it('falls back to current schedule context when curated afternoon sources have expired', async () => {
    const expiredEvent = scheduleEvent({
      googleEventId: 'expired',
      start: Date.parse('2026-07-13T20:00:00.000Z'),
      end: Date.parse('2026-07-13T21:00:00.000Z')
    });
    const currentEvent = scheduleEvent({ googleEventId: 'current', title: 'Afternoon appointment' });
    const briefing = morningBriefing({
      afternoon: [
        {
          text: 'Old afternoon item',
          who: [],
          sourceIds: [`family-calendar:${expiredEvent.googleEventId}:${expiredEvent.start}`]
        }
      ]
    });
    const ctx = createActiveBoardCtx({
      briefing,
      events: [expiredEvent, currentEvent],
      plan: null,
      recipes: []
    });

    const result = await readActiveBoard(ctx as never, {
      now: new Date('2026-07-13T22:00:00.000Z'),
      timeZone: 'Australia/Sydney'
    });

    expect(result.items[0]).toMatchObject({
      kind: 'today',
      laterToday: [{ id: `family-calendar:current:${currentEvent.start}`, title: 'Afternoon appointment' }]
    });
  });
});

function scheduleEvent(overrides: Record<string, unknown> = {}) {
  return {
    googleEventId: 'event',
    calendarId: 'family-calendar',
    start: Date.parse('2026-07-13T23:00:00.000Z'),
    end: Date.parse('2026-07-14T00:00:00.000Z'),
    allDay: false,
    title: 'Current event',
    kind: 'event' as const,
    who: [],
    recurring: false,
    ...overrides
  };
}

function morningBriefing(
  overrides: Partial<{
    morning: { text: string; who: string[]; sourceIds: string[] }[];
    afternoon: { text: string; who: string[]; sourceIds: string[] }[];
  }> = {}
) {
  return {
    briefingKey: 'morning:2026-07-14',
    briefingKind: 'morning' as const,
    localDate: '2026-07-14',
    generationStatus: 'deterministic' as const,
    generatedAt: 1,
    message: 'Briefing',
    briefing: {
      shouldSend: true,
      headline: 'Today',
      morning: overrides.morning ?? [],
      afternoon: overrides.afternoon ?? [],
      watchouts: [],
      sourceIdsIgnored: []
    },
    sourceIds: []
  };
}

type ActiveBoardRows = {
  briefing: Record<string, unknown> | null;
  events: Record<string, unknown>[];
  plan: Record<string, unknown> | null;
  recipes: { publicId: string; name: string }[];
  emailNotices?: Record<string, unknown>[];
  spendingInsights?: Record<string, unknown>[];
  manualNotes?: Record<string, unknown>[];
  boardArchives?: Record<string, unknown>[];
};

function createActiveBoardCtx(rows: ActiveBoardRows) {
  return {
    auth: { getUserIdentity: async () => ({ subject: 'user_123' }) },
    db: {
      query: (table: string) => ({
        collect: async () => {
          if (table === 'emailNotices') return rows.emailNotices ?? [];
          if (table === 'spendingInsights') return rows.spendingInsights ?? [];
          if (table === 'manualNotes') return rows.manualNotes ?? [];
          if (table === 'boardArchives') return rows.boardArchives ?? [];
          return [];
        },
        withIndex: (_index: string, apply?: (query: { eq: (_field: string, value: string) => string }) => unknown) => {
          let value = '';
          apply?.({
            eq: (_field, expected) => {
              value = expected;
              return expected;
            }
          });

          return {
            collect: async () => (table === 'scheduleEvents' ? rows.events : []),
            unique: async () => {
              if (table === 'briefings') return rows.briefing?.briefingKey === value ? rows.briefing : null;
              if (table === 'weeklyMealPlans') return rows.plan?.weekStart === value ? rows.plan : null;
              if (table === 'recipes') return rows.recipes.find((recipe) => recipe.publicId === value) ?? null;
              return null;
            }
          };
        }
      })
    }
  };
}

function boardArchive(occurrenceId: string, sourceKind: string) {
  return { occurrenceId, sourceKind, archivedByUserId: 'household-user-1', archivedAt: 2 };
}

function manualNote(id: string, dueDate?: string) {
  return {
    _id: id,
    title: `Note ${id}`,
    detail: `Detail ${id}`,
    ...(dueDate ? { dueDate } : {}),
    authorUserId: 'household-user-1',
    createdAt: 1,
    updatedAt: 1
  };
}

function spendingInsight(monthKey: string, overrides: Record<string, unknown> = {}) {
  return {
    monthKey,
    headline: `Headline for ${monthKey}`,
    observations: ['Groceries drifted upward while dining out fell.'],
    prediction: 'Expect card spend to settle near the trailing average.',
    generatedAt: 1_700_000_000_000,
    model: 'test-model',
    ...overrides
  };
}
