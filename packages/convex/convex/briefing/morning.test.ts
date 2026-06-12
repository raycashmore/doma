import { describe, expect, it } from 'vitest';

import {
  collectMorningBriefingEvents,
  createDeterministicMorningBriefing,
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
        "Morning briefing\n\nDaily requirements calendar is not configured yet, so I can't check day-specific requirements."
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
      message: "Morning briefing\n\nToday's requirements\n- memberA: Bring sports bag"
    });
  });

  it('returns deterministic weekday quiet output when no actionable items exist', () => {
    expect(
      createDeterministicMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: []
      }).message
    ).toBe('Morning briefing\n\nNormal day. No special requirements found.');
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
      message:
        "Morning briefing\n\nI couldn't summarise the day automatically.\n\nToday's requirements:\n- memberA: Bring sports bag",
      sourceIds: ['requirements-calendar:requirements-1:1781218800000']
    });
  });

  it('uses deterministic empty fallback text when no daily requirements exist', () => {
    expect(formatMorningBriefingFallback({ events: [event({ googleEventId: 'ordinary-1' })] })).toEqual({
      message: "Morning briefing\n\nI couldn't summarise the day automatically.\n\nNo daily requirements found.",
      sourceIds: []
    });
  });
});

describe('morningBriefingKey', () => {
  it('keys morning briefings by briefing kind and local date', () => {
    expect(morningBriefingKey({ briefingKind: 'morning', localDate })).toBe('morning:2026-06-12');
  });
});
