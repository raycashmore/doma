import { describe, expect, it } from 'vitest';

import type { ScheduleDisplayMember } from '../schedule/config';
import {
  collectMorningBriefingEvents,
  createDeterministicMorningBriefing,
  formatBriefingDeliveryMessage,
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

const members: ScheduleDisplayMember[] = [
  { id: 'childA', label: 'Child A', initials: 'CA' },
  { id: 'childB', label: 'Child B', initials: 'CB' },
  { id: 'adultA', label: 'Adult A', initials: 'AA' }
];

describe('formatMorningBriefing', () => {
  it('groups lines by time block then by member config order', () => {
    expect(
      formatMorningBriefing(
        {
          shouldSend: true,
          headline: 'homework, sport clothes, and dance drop-offs/pick-ups.',
          morning: [{ text: 'wear sport clothes', who: ['childA'], sourceIds: ['req:wear:1'] }],
          afternoon: [
            { text: 'pick up Child A at 7pm', who: ['adultA'], sourceIds: ['cal:pickup:1'] },
            { text: 'bring water bottle and snack for dancing', who: ['childA'], sourceIds: ['req:pack:1'] }
          ],
          watchouts: [],
          sourceIdsIgnored: []
        },
        members
      )
    ).toBe(`Today:
homework, sport clothes, and dance drop-offs/pick-ups.

This morning:
- Child A: wear sport clothes

This afternoon:
- Child A: bring water bottle and snack for dancing
- Adult A: pick up Child A at 7pm`);
  });

  it('renders watchouts without a person prefix and omits empty blocks', () => {
    expect(
      formatMorningBriefing(
        {
          shouldSend: true,
          headline: 'One clash to watch.',
          morning: [],
          afternoon: [{ text: 'drop off Child A at 4pm', who: ['adultA'], sourceIds: ['cal:drop:1'] }],
          watchouts: [{ text: 'Two pickups clash at 7pm', who: [], sourceIds: ['cal:clash:1'] }],
          sourceIdsIgnored: []
        },
        members
      )
    ).toBe(`Today:
One clash to watch.

This afternoon:
- Adult A: drop off Child A at 4pm

Watchouts
- Two pickups clash at 7pm`);
  });

  it('returns an empty message when the briefing is suppressed', () => {
    expect(
      formatMorningBriefing(
        {
          shouldSend: false,
          headline: 'No briefing needed.',
          morning: [],
          afternoon: [],
          watchouts: [],
          sourceIdsIgnored: []
        },
        members
      )
    ).toBe('');
  });

  it('falls back to the raw id and removes leaked member-token prefixes', () => {
    const message = formatMorningBriefing(
      {
        shouldSend: true,
        headline: 'Routine day.',
        morning: [{ text: 'memberA: confirm classroom note', who: ['unknownX'], sourceIds: ['req:note:1'] }],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      },
      members
    );

    expect(message).toBe(`Today:
Routine day.

This morning:
- unknownX: confirm classroom note`);
    expect(message).not.toContain('memberA');
    expect(message).not.toContain('someone');
  });

  it('does not rewrite internal member tokens to someone', () => {
    const message = formatMorningBriefing(
      {
        shouldSend: true,
        headline: 'memberA logistics are still being checked.',
        morning: [],
        afternoon: [],
        watchouts: [{ text: 'memberB timing needs a second look.', who: [], sourceIds: ['cal:watch:1'] }],
        sourceIdsIgnored: []
      },
      members
    );

    expect(message).toBe(`Today:
memberA logistics are still being checked.

Watchouts
- memberB timing needs a second look.`);
    expect(message).not.toContain('someone');
  });

  it('removes leaked internal member tokens from person-prefixed briefing text', () => {
    const message = formatMorningBriefing(
      {
        shouldSend: true,
        headline: 'A school-and-sport day.',
        morning: [
          {
            text: 'School runs and memberA start at 9:00; warm layers help.',
            who: ['childA', 'childB'],
            sourceIds: ['cal:school:1']
          },
          {
            text: 'School day and memberC; a warm layer will help with the cold morning.',
            who: ['childA', 'childB'],
            sourceIds: ['cal:school:2']
          }
        ],
        afternoon: [
          {
            text: 'memberA has swimming at 5:00; pack goggles, swimmers, and towel.',
            who: ['childA'],
            sourceIds: ['cal:swim:1']
          }
        ],
        watchouts: [],
        sourceIdsIgnored: []
      },
      [...members, { id: 'childB', label: 'Child B', initials: 'CB' }]
    );

    expect(message).toBe(`Today:
A school-and-sport day.

This morning:
- Child A, Child B: School runs start at 9:00; warm layers help.
- Child A, Child B: School day; a warm layer will help with the cold morning.

This afternoon:
- Child A: Swimming at 5:00; pack goggles, swimmers, and towel.`);
    expect(message).not.toContain('someone');
    expect(message).not.toContain('memberA');
    expect(message).not.toContain('memberC');
  });
});

describe('formatBriefingDeliveryMessage', () => {
  it('renders the morning delivery as the summary and morning details only', () => {
    const message = formatBriefingDeliveryMessage(
      {
        shouldSend: true,
        headline: 'Library bag and sport clothes.',
        morning: [{ text: 'pack library bag', who: ['childA'], sourceIds: ['req:library:1'] }],
        afternoon: [{ text: 'bring water bottle for dancing', who: ['childA'], sourceIds: ['req:dance:1'] }],
        watchouts: [{ text: 'Homework folder is due back.', who: [], sourceIds: ['req:homework:1'] }],
        sourceIdsIgnored: []
      },
      members,
      { slot: 'morning' }
    );

    expect(message).toBe(`Library bag and sport clothes.

This morning:
- Child A: pack library bag

Watchouts
- Homework folder is due back.`);
    expect(message).not.toContain('Today:');
    expect(message).not.toContain('dancing');
  });

  it('renders afternoon details with relevant afternoon weather readiness', () => {
    const message = formatBriefingDeliveryMessage(
      {
        shouldSend: true,
        headline: 'Library bag and sport clothes.',
        morning: [{ text: 'pack library bag', who: ['childA'], sourceIds: ['req:library:1'] }],
        afternoon: [{ text: 'bring water bottle for dancing', who: ['childA'], sourceIds: ['req:dance:1'] }],
        watchouts: [],
        sourceIdsIgnored: []
      },
      members,
      {
        slot: 'afternoon',
        weather: {
          summary: 'Wet afternoon.',
          morning: {
            temperatureC: { min: 12, max: 18 },
            apparentTemperatureC: { min: 12, max: 18 },
            rainChancePercent: 10,
            maxWindGustKph: 10,
            maxUvIndex: 2,
            readiness: []
          },
          afternoon: {
            temperatureC: { min: 17, max: 21 },
            apparentTemperatureC: { min: 16, max: 20 },
            rainChancePercent: 80,
            maxWindGustKph: 12,
            maxUvIndex: 3,
            readiness: ['rain layer']
          }
        }
      }
    );

    expect(message).toBe(`This afternoon:
- Child A: bring water bottle for dancing

Weather:
- Rain layer may help this afternoon.`);
    expect(message).not.toContain('Library bag');
    expect(message).not.toContain('pack library bag');
  });

  it('removes repeated leading person names from delivery lines', () => {
    const message = formatBriefingDeliveryMessage(
      {
        shouldSend: true,
        headline: 'Dancing and swimming.',
        morning: [],
        afternoon: [
          {
            text: 'Child A has dancing at 4:00 with Adult A picking up Child A.',
            who: ['childA'],
            sourceIds: ['req:dance:1']
          },
          {
            text: 'Child B has swimming at 5:00; bring goggles, swimmers, and a towel.',
            who: ['childB'],
            sourceIds: ['req:swim:1']
          }
        ],
        watchouts: [],
        sourceIdsIgnored: []
      },
      members,
      { slot: 'afternoon' }
    );

    expect(message).toBe(`This afternoon:
- Child A: Dancing at 4:00 with Adult A picking up Child A.
- Child B: Swimming at 5:00; bring goggles, swimmers, and a towel.`);
  });
});

describe('createDeterministicMorningBriefing', () => {
  it('treats a missing daily requirements calendar as a setup problem', () => {
    expect(
      createDeterministicMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'calendar-a', who: 'childA' }],
        events: [],
        members
      })
    ).toEqual({
      briefingKind: 'morning',
      localDate,
      generationStatus: 'setupProblem',
      sourceIds: [],
      briefing: {
        shouldSend: true,
        headline: "Daily requirements calendar is not configured yet, so I can't check day-specific requirements.",
        morning: [],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      },
      message: "Today:\nDaily requirements calendar is not configured yet, so I can't check day-specific requirements."
    });
  });

  it('assigns requirements to morning or afternoon by event start time and groups per person', () => {
    const result = createDeterministicMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
      events: [
        // 8am Sydney -> morning
        event({
          googleEventId: 'morning-req',
          calendarId: 'requirements-calendar',
          kind: 'dailyRequirements',
          start: Date.parse('2026-06-11T22:00:00.000Z'),
          end: Date.parse('2026-06-11T22:30:00.000Z'),
          who: ['childA'],
          description: 'Wear sport clothes'
        }),
        // 4pm Sydney -> afternoon
        event({
          googleEventId: 'afternoon-req',
          calendarId: 'requirements-calendar',
          kind: 'dailyRequirements',
          start: Date.parse('2026-06-12T06:00:00.000Z'),
          end: Date.parse('2026-06-12T06:30:00.000Z'),
          who: ['childA'],
          description: 'Bring water bottle for dancing'
        })
      ],
      members
    });

    expect(result).toMatchObject({
      generationStatus: 'deterministic',
      briefing: {
        headline: "Today's requirements",
        morning: [
          {
            text: 'Wear sport clothes',
            who: ['childA'],
            sourceIds: ['requirements-calendar:morning-req:1781215200000']
          }
        ],
        afternoon: [
          {
            text: 'Bring water bottle for dancing',
            who: ['childA'],
            sourceIds: ['requirements-calendar:afternoon-req:1781244000000']
          }
        ]
      }
    });
    expect(result.message).toBe(`Today:
Today's requirements

This morning:
- Child A: Wear sport clothes

This afternoon:
- Child A: Bring water bottle for dancing`);
  });

  it("treats all-day requirements as morning and combines a person's items", () => {
    const result = createDeterministicMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
      events: [
        event({
          googleEventId: 'all-day-1',
          calendarId: 'requirements-calendar',
          kind: 'dailyRequirements',
          allDay: true,
          who: ['childA'],
          description: 'Wear sport clothes'
        }),
        event({
          googleEventId: 'all-day-2',
          calendarId: 'requirements-calendar',
          kind: 'dailyRequirements',
          allDay: true,
          who: ['childA'],
          description: 'Bring homework'
        })
      ],
      members
    });

    expect(result.briefing.morning).toEqual([
      {
        text: 'Wear sport clothes; Bring homework',
        who: ['childA'],
        sourceIds: ['requirements-calendar:all-day-1:1781218800000', 'requirements-calendar:all-day-2:1781218800000']
      }
    ]);
    expect(result.briefing.afternoon).toEqual([]);
  });

  it('returns deterministic quiet output when no requirements exist', () => {
    expect(
      createDeterministicMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: [],
        members
      }).message
    ).toBe('Today:\nNormal day. No special requirements found.');
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
  it('includes daily requirements events only, grouped into time blocks', () => {
    expect(
      formatMorningBriefingFallback({
        timeZone,
        members,
        events: [
          event({
            googleEventId: 'requirements-1',
            calendarId: 'requirements-calendar',
            kind: 'dailyRequirements',
            allDay: true,
            who: ['childA'],
            title: 'Sports uniform',
            description: 'Bring sports bag'
          }),
          event({ googleEventId: 'ordinary-1', calendarId: 'calendar-a', title: 'Dentist' })
        ]
      })
    ).toEqual({
      message: "Today:\nToday's requirements\n\nThis morning:\n- Child A: Bring sports bag",
      sourceIds: ['requirements-calendar:requirements-1:1781218800000']
    });
  });

  it('places a post-noon daily-requirement under This afternoon:', () => {
    const afternoonStart = Date.parse('2026-06-12T06:00:00.000Z'); // 4pm Australia/Sydney
    expect(
      formatMorningBriefingFallback({
        timeZone,
        members,
        events: [
          event({
            googleEventId: 'afternoon-pm-1',
            calendarId: 'requirements-calendar',
            kind: 'dailyRequirements',
            start: afternoonStart,
            end: afternoonStart + 30 * 60 * 1000,
            allDay: false,
            who: ['childA'],
            title: 'Afternoon activity',
            description: 'Bring water bottle for afternoon activity'
          })
        ]
      })
    ).toEqual({
      message: "Today:\nToday's requirements\n\nThis afternoon:\n- Child A: Bring water bottle for afternoon activity",
      sourceIds: [`requirements-calendar:afternoon-pm-1:${afternoonStart}`]
    });
  });

  it('uses deterministic empty fallback text when no daily requirements exist', () => {
    expect(
      formatMorningBriefingFallback({ timeZone, members, events: [event({ googleEventId: 'ordinary-1' })] })
    ).toEqual({
      message: 'Today:\nNo daily requirements found.',
      sourceIds: []
    });
  });
});

describe('morningBriefingKey', () => {
  it('keys morning briefings by briefing kind and local date', () => {
    expect(morningBriefingKey({ briefingKind: 'morning', localDate })).toBe('morning:2026-06-12');
  });
});
