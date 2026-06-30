import { describe, expect, it, vi } from 'vitest';

import type { ScheduleDisplayMember } from '../schedule/config';
import {
  createAiMorningBriefing,
  createOpenAiMorningBriefingProvider,
  type MorningBriefingAiInput,
  type MorningBriefingAiProvider,
  morningBriefingOutputJsonSchema,
  morningBriefingSystemPrompt
} from './ai';
import type { MorningBriefingEvent } from './morning';
import type { MorningBriefingWeatherContext } from './weather';

const timeZone = 'Australia/Sydney';
const localDate = '2026-06-12';

const members: ScheduleDisplayMember[] = [
  { id: 'childA', label: 'Child A', initials: 'CA' },
  { id: 'adultA', label: 'Adult A', initials: 'AA' }
];

const requirementsCalendar = { calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' } as const;

const weather: MorningBriefingWeatherContext = {
  summary: 'Cold morning, wet afternoon.',
  morning: {
    temperatureC: { min: 8, max: 11 },
    apparentTemperatureC: { min: 6, max: 9 },
    rainChancePercent: 20,
    maxWindGustKph: 18,
    maxUvIndex: 2,
    readiness: ['warm layer']
  },
  afternoon: {
    temperatureC: { min: 13, max: 15 },
    apparentTemperatureC: { min: 12, max: 13 },
    rainChancePercent: 70,
    maxWindGustKph: 30,
    maxUvIndex: 4,
    readiness: ['rain layer']
  }
};

function event(overrides: Partial<MorningBriefingEvent> = {}): MorningBriefingEvent {
  return {
    googleEventId: 'event-1',
    calendarId: 'calendar-a',
    start: Date.parse('2026-06-11T23:00:00.000Z'),
    end: Date.parse('2026-06-12T00:00:00.000Z'),
    allDay: false,
    title: 'School pickup',
    who: ['childA'],
    recurring: false,
    htmlLink: 'https://calendar.example/events/event-1',
    ...overrides
  };
}

function requirementEvent(overrides: Partial<MorningBriefingEvent> = {}): MorningBriefingEvent {
  return event({
    googleEventId: 'requirements-1',
    calendarId: 'requirements-calendar',
    kind: 'dailyRequirements',
    allDay: true,
    who: ['childA'],
    title: 'Sports uniform',
    description: 'Bring sports bag',
    ...overrides
  });
}

function ordinaryEvent(): MorningBriefingEvent {
  return event({
    googleEventId: 'ordinary-1',
    calendarId: 'calendar-a',
    start: Date.parse('2026-06-12T06:00:00.000Z'),
    end: Date.parse('2026-06-12T08:00:00.000Z'),
    who: ['adultA'],
    title: 'Activity handoff',
    description: 'drop off and pick up'
  });
}

describe('createAiMorningBriefing', () => {
  it('passes optional weather context to the AI provider', async () => {
    const provider: MorningBriefingAiProvider = vi.fn(async (input: MorningBriefingAiInput) => {
      const requirement = input.sources.find((source) => source.kind === 'dailyRequirements');
      return {
        shouldSend: true,
        headline: 'Cold start for the sports bag day.',
        morning: [{ text: 'Bring sports bag', who: ['childA'], sourceIds: [requirement?.sourceId ?? 'missing'] }],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      };
    });

    await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members,
      weather
    });

    expect(provider).toHaveBeenCalledWith(
      expect.objectContaining({
        weather
      })
    );
  });

  it('passes local time and block guidance for pre-noon sources', async () => {
    const provider: MorningBriefingAiProvider = vi.fn(async (input: MorningBriefingAiInput) => {
      const requirement = input.sources.find((source) => source.kind === 'dailyRequirements');
      return {
        shouldSend: true,
        headline: 'Early performance morning.',
        morning: [
          { text: 'Performance starts early.', who: ['childA'], sourceIds: [requirement?.sourceId ?? 'missing'] }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      };
    });

    await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [
        requirementEvent({
          start: Date.parse('2026-06-11T21:45:00.000Z'),
          end: Date.parse('2026-06-11T22:30:00.000Z'),
          allDay: false,
          title: 'Performance',
          description: 'Performance starts early.'
        })
      ],
      provider,
      members
    });

    expect(provider).toHaveBeenCalledOnce();
    expect(vi.mocked(provider).mock.calls[0]?.[0].sources[0]).toMatchObject({
      localStart: '2026-06-12 07:45',
      localEnd: '2026-06-12 08:30',
      localTimeBlock: 'morning'
    });
  });

  it('uses a valid structured AI response and preserves source traceability', async () => {
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      const handoff = sources.find((source) => source.title === 'Activity handoff');
      return {
        shouldSend: true,
        headline: 'Sports kit and an afternoon handoff.',
        morning: [{ text: 'Bring sports bag', who: ['childA'], sourceIds: [requirement?.sourceId ?? 'missing'] }],
        afternoon: [{ text: 'drop off and pick up', who: ['adultA'], sourceIds: [handoff?.sourceId ?? 'missing'] }],
        watchouts: [],
        sourceIdsIgnored: []
      };
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent(), ordinaryEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('ai');
    expect(result.message).toBe(`Today:
Sports kit and an afternoon handoff.

This morning:
- Child A: Bring sports bag

This afternoon:
- Adult A: drop off and pick up`);
    expect(result.sourceIds).toEqual([
      'requirements-calendar:requirements-1:1781218800000',
      'calendar-a:ordinary-1:1781244000000'
    ]);
  });

  it('renders watchouts under a Watchouts header and excludes them from morning/afternoon blocks', async () => {
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      const handoff = sources.find((source) => source.title === 'Activity handoff');
      return {
        shouldSend: true,
        headline: 'Sports kit and a clash to watch.',
        morning: [{ text: 'Bring sports bag', who: ['childA'], sourceIds: [requirement?.sourceId ?? 'missing'] }],
        afternoon: [],
        watchouts: [
          { text: 'Two pickups clash at pickup time', who: ['adultA'], sourceIds: [handoff?.sourceId ?? 'missing'] }
        ],
        sourceIdsIgnored: []
      };
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent(), ordinaryEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('ai');
    expect(result.message).toContain('Watchouts');
    expect(result.message).toContain('Two pickups clash at pickup time');
    // The watchout must NOT appear as a block line under This morning: or This afternoon:
    expect(result.message).not.toMatch(/This morning:[^\n]*\n(?:- [^\n]*\n)*- [^:]*Two pickups/);
    expect(result.message).not.toMatch(/This afternoon:[^\n]*\n(?:- [^\n]*\n)*- [^:]*Two pickups/);
    expect(result.message).toBe(`Today:
Sports kit and a clash to watch.

This morning:
- Child A: Bring sports bag

Watchouts
- Two pickups clash at pickup time`);
  });

  it('treats a missing daily requirements calendar as a setup problem before calling AI', async () => {
    const provider = vi.fn();
    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [{ calendarId: 'calendar-a', who: 'adultA' }],
      events: [ordinaryEvent()],
      provider: provider as unknown as MorningBriefingAiProvider,
      members
    });

    expect(provider).not.toHaveBeenCalled();
    expect(result.generationStatus).toBe('setupProblem');
  });

  it('falls back to a neutral requirements summary when an item shape is invalid', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider: MorningBriefingAiProvider = async () => ({
      shouldSend: true,
      headline: 'Broken',
      morning: [{ text: 42, who: ['childA'], sourceIds: [] }],
      afternoon: [],
      watchouts: [],
      sourceIdsIgnored: []
    });

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('fallback');
    expect(result.message).toContain('This morning:');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[briefing.ai]'), expect.anything());
    consoleError.mockRestore();
  });

  it('falls back when AI prose leaks internal member ids', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      return {
        shouldSend: true,
        headline: 'School-and-library day.',
        morning: [
          {
            text: 'memberC needs the library bag',
            who: ['childA'],
            sourceIds: [requirement?.sourceId ?? 'missing']
          }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      };
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('fallback');
    expect(result.message).toContain('Bring sports bag');
    expect(result.message).not.toContain('memberC');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[briefing.ai]'), expect.anything());
    consoleError.mockRestore();
  });

  it('falls back when AI prose leaks internal member ids with casing variants', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider: MorningBriefingAiProvider = vi
      .fn()
      .mockResolvedValueOnce({
        shouldSend: true,
        headline: 'School-and-library day.',
        morning: [
          {
            text: 'MemberC needs the library bag',
            who: ['childA'],
            sourceIds: ['requirements-calendar:requirements-1:1781218800000']
          }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      })
      .mockResolvedValueOnce({
        shouldSend: true,
        headline: 'School-and-library day.',
        morning: [
          {
            text: 'memberc needs the library bag',
            who: ['childA'],
            sourceIds: ['requirements-calendar:requirements-1:1781218800000']
          }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      });

    const firstResult = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });
    const secondResult = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });

    expect(firstResult.generationStatus).toBe('fallback');
    expect(secondResult.generationStatus).toBe('fallback');
    expect(firstResult.message).not.toContain('MemberC');
    expect(secondResult.message).not.toContain('memberc');
    consoleError.mockRestore();
  });

  it('falls back when AI prose leaks configured member ids with punctuation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      return {
        shouldSend: true,
        headline: 'School-and-library day.',
        morning: [
          {
            text: 'child-a needs the library bag',
            who: ['child-a'],
            sourceIds: [requirement?.sourceId ?? 'missing']
          }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      };
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent({ who: ['child-a'] })],
      provider,
      members: [{ id: 'child-a', label: 'Child A', initials: 'CA' }]
    });

    expect(result.generationStatus).toBe('fallback');
    expect(result.message).not.toContain('child-a');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[briefing.ai]'), expect.anything());
    consoleError.mockRestore();
  });

  it('falls back when AI line ownership uses unknown member ids', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      return {
        shouldSend: true,
        headline: 'School-and-library day.',
        morning: [
          {
            text: 'Needs the library bag',
            who: ['memberC'],
            sourceIds: [requirement?.sourceId ?? 'missing']
          }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      };
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('fallback');
    expect(result.message).not.toContain('memberC');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[briefing.ai]'), expect.anything());
    consoleError.mockRestore();
  });

  it('falls back when AI prose contains markup or escaped HTML entities', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      return {
        shouldSend: true,
        headline: 'Library &amp; sock day.',
        morning: [
          {
            text: 'Bring the <b>library</b> bag and Crazy Hair &amp; Sock Day gear.',
            who: ['childA'],
            sourceIds: [requirement?.sourceId ?? 'missing']
          }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      };
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('fallback');
    expect(result.message).toContain('Bring sports bag');
    expect(result.message).not.toContain('<b>');
    expect(result.message).not.toContain('&amp;');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[briefing.ai]'), expect.anything());
    consoleError.mockRestore();
  });

  it('falls back when AI prose contains broad named HTML entities', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      return {
        shouldSend: true,
        headline: 'Library day.',
        morning: [
          {
            text: 'Bring library bag &rsquo; note.',
            who: ['childA'],
            sourceIds: [requirement?.sourceId ?? 'missing']
          }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      };
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('fallback');
    expect(result.message).not.toContain('&rsquo;');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[briefing.ai]'), expect.anything());
    consoleError.mockRestore();
  });

  it('accepts plain text that uses a raw ampersand', async () => {
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      return {
        shouldSend: true,
        headline: 'Hair & sock day.',
        morning: [
          {
            text: 'Bring library bag and hair & sock day items.',
            who: ['childA'],
            sourceIds: [requirement?.sourceId ?? 'missing']
          }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      };
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('ai');
    expect(result.message).toContain('Hair & sock day.');
    expect(result.message).toContain('hair & sock day items');
  });

  it('accepts ordinary words that start with member', async () => {
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      return {
        shouldSend: true,
        headline: 'Household members have one school note.',
        morning: [
          {
            text: 'Family members should bring the note.',
            who: ['childA'],
            sourceIds: [requirement?.sourceId ?? 'missing']
          }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      };
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('ai');
    expect(result.message).toContain('Household members');
    expect(result.message).toContain('Family members');
  });

  it('logs and falls back when the AI provider throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider: MorningBriefingAiProvider = async () => {
      throw new Error('boom');
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('fallback');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[briefing.ai]'), expect.anything());
    consoleError.mockRestore();
  });

  it('drops a line whose sourceIds are all unknown but keeps grounded lines', async () => {
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      return {
        shouldSend: true,
        headline: 'One grounded line.',
        morning: [
          { text: 'Bring sports bag', who: ['childA'], sourceIds: [requirement?.sourceId ?? 'missing'] },
          { text: 'Invented obligation', who: ['childA'], sourceIds: ['not-a-real-source'] }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      };
    };

    const result = await createAiMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [requirementEvent()],
      provider,
      members
    });

    expect(result.generationStatus).toBe('ai');
    expect(result.briefing.morning).toHaveLength(1);
    expect(result.briefing.morning[0]?.text).toBe('Bring sports bag');
  });

  it('falls back to deterministic quiet output when AI suppresses an empty weekday', async () => {
    const provider: MorningBriefingAiProvider = async () => ({
      shouldSend: false,
      headline: 'Nothing today.',
      morning: [],
      afternoon: [],
      watchouts: [],
      sourceIdsIgnored: []
    });

    const result = await createAiMorningBriefing({
      localDate, // 2026-06-12 is a Friday
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [],
      provider,
      members
    });

    expect(result.generationStatus).toBe('deterministic');
    expect(result.message).toBe('Today:\nNormal day. No special requirements found.');
  });

  it('allows AI to suppress an empty weekend briefing', async () => {
    const provider: MorningBriefingAiProvider = async () => ({
      shouldSend: false,
      headline: 'Weekend, nothing on.',
      morning: [],
      afternoon: [],
      watchouts: [],
      sourceIdsIgnored: []
    });

    const result = await createAiMorningBriefing({
      localDate: '2026-06-13', // Saturday
      timeZone,
      calendarConfigs: [requirementsCalendar],
      events: [],
      provider,
      members
    });

    expect(result.generationStatus).toBe('ai');
    expect(result.message).toBe('');
  });
});

describe('morningBriefingSystemPrompt', () => {
  it('instructs the model to group by time of day and person', () => {
    expect(morningBriefingSystemPrompt).toContain('morning');
    expect(morningBriefingSystemPrompt).toContain('afternoon');
    expect(morningBriefingSystemPrompt).toContain('watchout');
  });

  it('instructs the model to write grounded non-generic headlines', () => {
    expect(morningBriefingSystemPrompt).toContain('Avoid generic headlines');
    expect(morningBriefingSystemPrompt).toContain('Morning and afternoon readiness');
    expect(morningBriefingSystemPrompt).toContain('pre-noon');
    expect(morningBriefingSystemPrompt).toContain('supplied weather');
  });

  it('instructs the model to keep generated prose plain text', () => {
    expect(morningBriefingSystemPrompt).toContain('plain text');
    expect(morningBriefingSystemPrompt).toContain('Do not include HTML');
    expect(morningBriefingSystemPrompt).toContain('Do not write member ids inside prose');
  });
});

describe('createOpenAiMorningBriefingProvider', () => {
  it('requests a strict structured morning briefing and parses the JSON response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    shouldSend: true,
                    headline: 'Test',
                    morning: [],
                    afternoon: [],
                    watchouts: [],
                    sourceIdsIgnored: []
                  })
                }
              }
            ]
          })
        )
    );
    const provider = createOpenAiMorningBriefingProvider({ apiKey: 'key', model: 'gpt-test', fetchImpl });

    const result = await provider({ localDate, timeZone, sources: [] });

    expect(result).toMatchObject({ shouldSend: true, headline: 'Test' });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [unknown, RequestInit])[1].body as string);
    expect(body.response_format.json_schema.schema).toEqual(morningBriefingOutputJsonSchema);
  });
});
