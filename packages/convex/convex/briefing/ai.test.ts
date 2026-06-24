import { describe, expect, it, vi } from 'vitest';

import type { ScheduleDisplayMember } from '../schedule/config';
import {
  createAiMorningBriefing,
  createOpenAiMorningBriefingProvider,
  type MorningBriefingAiProvider,
  morningBriefingOutputJsonSchema,
  morningBriefingSystemPrompt
} from './ai';
import type { MorningBriefingEvent } from './morning';

const timeZone = 'Australia/Sydney';
const localDate = '2026-06-12';

const members: ScheduleDisplayMember[] = [
  { id: 'childA', label: 'Child A', initials: 'CA' },
  { id: 'adultA', label: 'Adult A', initials: 'AA' }
];

const requirementsCalendar = { calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' } as const;

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

function requirementEvent(): MorningBriefingEvent {
  return event({
    googleEventId: 'requirements-1',
    calendarId: 'requirements-calendar',
    kind: 'dailyRequirements',
    allDay: true,
    who: ['childA'],
    title: 'Sports uniform',
    description: 'Bring sports bag'
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
