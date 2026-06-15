import { describe, expect, it } from 'vitest';

import {
  collectMorningBriefingEvents,
  createDeterministicMorningBriefing,
  formatMorningBriefing,
  formatMorningBriefingFallback,
  type MorningBriefingEvent,
  morningBriefingKey
} from './morning';

const timeZone = 'Australia/Sydney';
const localDate = '2026-06-12';

function event(overrides: Partial<MorningBriefingEvent> = {}): MorningBriefingEvent {
  return {
    googleEventId: 'event-1',
    calendarId: 'calendar-a',
    start: Date.parse('2026-06-11T23:00:00.000Z'),
    end: Date.parse('2026-06-12T00:00:00.000Z'),
    allDay: false,
    title: 'School pickup',
    who: ['memberA'],
    recurring: false,
    htmlLink: 'https://calendar.example/events/event-1',
    ...overrides
  };
}

describe('formatMorningBriefing', () => {
  it('preserves readiness groups instead of flattening every item', () => {
    expect(
      formatMorningBriefing({
        shouldSend: true,
        headline: 'Busy coordination day: school items, activity packing, and evening chores.',
        importantItems: [
          {
            text: 'memberA handoff: adultA drops off at 4pm; adultB picks up at 7pm.',
            kind: 'important',
            tags: ['coordinate'],
            sourceIds: ['calendar-a:event-important:1']
          }
        ],
        routineItems: [
          {
            text: 'memberA: wear sport clothes.',
            kind: 'routine',
            tags: ['wear'],
            sourceIds: ['requirements-calendar:event-wear:1']
          },
          {
            text: 'memberA and memberB: bring homework.',
            kind: 'routine',
            tags: ['remember', 'bring'],
            sourceIds: ['requirements-calendar:event-homework:1']
          },
          {
            text: 'memberA: water bottle and snack.',
            kind: 'routine',
            tags: ['bring'],
            sourceIds: ['requirements-calendar:event-pack:1']
          },
          {
            text: 'adultA handles activity drop-off and pickup.',
            kind: 'routine',
            tags: ['coordinate'],
            sourceIds: ['calendar-a:event-coordinate:1']
          }
        ],
        timingNotes: [],
        uncertaintyNotes: [
          {
            text: 'Check whether rehearsal needs special shoes.',
            kind: 'uncertain',
            tags: [],
            sourceIds: ['calendar-a:event-uncertain:1']
          }
        ],
        sourceIdsIgnored: []
      })
    ).toBe(`Morning briefing
Busy coordination day: school items, activity packing, and evening chores.
Watchouts
- memberA handoff: adultA drops off at 4pm; adultB picks up at 7pm.
Before leaving
- memberA: wear sport clothes.
- memberA and memberB: bring homework.
Pack / bring
- memberA: water bottle and snack.
Logistics
- adultA handles activity drop-off and pickup.
Unclear
- Check whether rehearsal needs special shoes.`);
  });

  it('returns an empty message when AI suppresses the briefing', () => {
    expect(
      formatMorningBriefing({
        shouldSend: false,
        headline: 'No briefing needed.',
        routineItems: [],
        importantItems: [],
        timingNotes: [],
        uncertaintyNotes: [],
        sourceIdsIgnored: []
      })
    ).toBe('');
  });

  it('renders an untagged routine item exactly once', () => {
    const message = formatMorningBriefing({
      shouldSend: true,
      headline: 'Routine details need review.',
      routineItems: [
        {
          text: 'memberA: confirm classroom note.',
          kind: 'routine',
          tags: [],
          sourceIds: ['requirements-calendar:event-untagged:1']
        },
        {
          text: 'memberA: pack lunch box.',
          kind: 'routine',
          tags: ['bring'],
          sourceIds: ['requirements-calendar:event-bring:1']
        }
      ],
      importantItems: [],
      timingNotes: [],
      uncertaintyNotes: [],
      sourceIdsIgnored: []
    });

    expect(message).toBe(`Morning briefing
Routine details need review.
Before leaving
- memberA: confirm classroom note.
Pack / bring
- memberA: pack lunch box.`);
    expect(message.match(/memberA: confirm classroom note\./g)).toHaveLength(1);
  });
});

describe('createDeterministicMorningBriefing', () => {
  it('treats missing daily requirements calendar config as a setup problem', () => {
    expect(
      createDeterministicMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'calendar-a', who: 'memberA' }],
        events: []
      })
    ).toEqual({
      briefingKind: 'morning',
      localDate,
      generationStatus: 'setupProblem',
      sourceIds: [],
      briefing: {
        shouldSend: true,
        headline: "Daily requirements calendar is not configured yet, so I can't check day-specific requirements.",
        routineItems: [],
        importantItems: [],
        timingNotes: [],
        uncertaintyNotes: [],
        sourceIdsIgnored: []
      },
      message:
        "Morning briefing\nDaily requirements calendar is not configured yet, so I can't check day-specific requirements."
    });
  });

  it('creates deterministic routine items with source traceability from daily requirements', () => {
    expect(
      createDeterministicMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: [
          event({
            googleEventId: 'requirements-1',
            calendarId: 'requirements-calendar',
            kind: 'dailyRequirements',
            title: 'Sports uniform',
            description: 'Bring sports bag'
          })
        ]
      })
    ).toMatchObject({
      briefingKind: 'morning',
      localDate,
      generationStatus: 'deterministic',
      sourceIds: ['requirements-calendar:requirements-1:1781218800000'],
      briefing: {
        headline: "Today's requirements",
        routineItems: [
          {
            text: 'memberA: Bring sports bag',
            kind: 'routine',
            tags: ['bring'],
            sourceIds: ['requirements-calendar:requirements-1:1781218800000']
          }
        ],
        sourceIdsIgnored: []
      },
      message: "Morning briefing\nToday's requirements\nPack / bring\n- memberA: Bring sports bag"
    });
  });

  it('tags deterministic daily requirements by obvious action words', () => {
    expect(
      createDeterministicMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: [
          event({
            googleEventId: 'requirements-1',
            calendarId: 'requirements-calendar',
            kind: 'dailyRequirements',
            description: 'Wear sport clothes'
          }),
          event({
            googleEventId: 'requirements-2',
            calendarId: 'requirements-calendar',
            kind: 'dailyRequirements',
            description: 'Remember homework'
          }),
          event({
            googleEventId: 'requirements-3',
            calendarId: 'requirements-calendar',
            kind: 'dailyRequirements',
            description: 'Bring water bottle'
          })
        ]
      }).message
    ).toBe(`Morning briefing
Today's requirements
Before leaving
- memberA: Wear sport clothes
- memberA: Remember homework
Pack / bring
- memberA: Bring water bottle`);
  });

  it('returns deterministic weekday quiet output when no actionable items exist', () => {
    expect(
      createDeterministicMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: []
      }).message
    ).toBe('Morning briefing\nNormal day. No special requirements found.');
  });
});

describe('collectMorningBriefingEvents', () => {
  it('includes every event overlapping the local day', () => {
    const latePreviousNight = event({
      googleEventId: 'overnight-before',
      start: Date.parse('2026-06-11T13:30:00.000Z'), // 11:30pm Sydney on 2026-06-11
      end: Date.parse('2026-06-11T14:30:00.000Z') // 12:30am Sydney on 2026-06-12
    });
    const visibleDayEvent = event({
      googleEventId: 'visible-day',
      start: Date.parse('2026-06-12T00:00:00.000Z'),
      end: Date.parse('2026-06-12T01:00:00.000Z')
    });
    const tomorrowOnly = event({
      googleEventId: 'tomorrow-only',
      start: Date.parse('2026-06-12T14:00:00.000Z'), // midnight Sydney on 2026-06-13
      end: Date.parse('2026-06-12T15:00:00.000Z')
    });

    expect(
      collectMorningBriefingEvents({
        events: [tomorrowOnly, visibleDayEvent, latePreviousNight],
        localDate,
        timeZone
      }).map((briefingEvent) => briefingEvent.googleEventId)
    ).toEqual(['overnight-before', 'visible-day']);
  });
});

describe('formatMorningBriefingFallback', () => {
  it('includes daily requirements events only', () => {
    expect(
      formatMorningBriefingFallback({
        events: [
          event({
            googleEventId: 'requirements-1',
            calendarId: 'requirements-calendar',
            kind: 'dailyRequirements',
            title: 'Sports uniform',
            description: 'Bring sports bag'
          }),
          event({ googleEventId: 'ordinary-1', calendarId: 'calendar-a', title: 'Dentist' })
        ]
      })
    ).toEqual({
      message: "Morning briefing\nToday's requirements\nPack / bring\n- memberA: Bring sports bag",
      sourceIds: ['requirements-calendar:requirements-1:1781218800000']
    });
  });

  it('uses deterministic empty fallback text when no daily requirements exist', () => {
    expect(formatMorningBriefingFallback({ events: [event({ googleEventId: 'ordinary-1' })] })).toEqual({
      message: 'Morning briefing\nNo daily requirements found.',
      sourceIds: []
    });
  });
});

describe('morningBriefingKey', () => {
  it('keys morning briefings by briefing kind and local date', () => {
    expect(morningBriefingKey({ briefingKind: 'morning', localDate })).toBe('morning:2026-06-12');
  });
});
