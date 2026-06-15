import { describe, expect, it, vi } from 'vitest';

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

describe('createAiMorningBriefing', () => {
  it('uses a valid structured AI response and preserves source traceability', async () => {
    const provider: MorningBriefingAiProvider = async ({ sources }) => {
      const requirement = sources.find((source) => source.kind === 'dailyRequirements');
      const ordinaryEvent = sources.find((source) => source.title === 'Activity handoff');
      expect(requirement).toMatchObject({ description: 'Bring sports bag' });
      expect(ordinaryEvent).toMatchObject({ description: 'adultA drops off; adultB picks up' });
      return {
        shouldSend: true,
        headline: 'One handoff to confirm',
        routineItems: [],
        importantItems: [
          {
            text: 'memberA handoff: adultA drops off; adultB picks up.',
            kind: 'important',
            tags: ['coordinate'],
            sourceIds: [ordinaryEvent?.sourceId ?? 'missing-source']
          }
        ],
        timingNotes: [],
        uncertaintyNotes: [],
        sourceIdsIgnored: [requirement?.sourceId ?? 'missing-source']
      };
    };

    await expect(
      createAiMorningBriefing({
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
          }),
          event({
            googleEventId: 'ordinary-1',
            calendarId: 'calendar-a',
            title: 'Activity handoff',
            description: 'adultA drops off; adultB picks up'
          })
        ],
        provider
      })
    ).resolves.toMatchObject({
      briefingKind: 'morning',
      localDate,
      generationStatus: 'ai',
      sourceIds: ['calendar-a:ordinary-1:1781218800000'],
      briefing: {
        headline: 'One handoff to confirm',
        importantItems: [
          {
            text: 'memberA handoff: adultA drops off; adultB picks up.',
            kind: 'important',
            tags: ['coordinate'],
            sourceIds: ['calendar-a:ordinary-1:1781218800000']
          }
        ],
        sourceIdsIgnored: ['requirements-calendar:requirements-1:1781218800000']
      },
      message:
        'Morning briefing\nOne handoff to confirm\nWatchouts\n- memberA handoff: adultA drops off; adultB picks up.'
    });
  });

  it('treats missing daily requirements calendar config as a setup problem before calling AI', async () => {
    let providerCalled = false;

    await expect(
      createAiMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'calendar-a', who: 'memberA' }],
        events: [],
        provider: async () => {
          providerCalled = true;
          return {
            shouldSend: true,
            headline: 'Normal day.',
            routineItems: [],
            importantItems: [],
            timingNotes: [],
            uncertaintyNotes: [],
            sourceIdsIgnored: []
          };
        }
      })
    ).resolves.toMatchObject({
      generationStatus: 'setupProblem',
      message:
        "Morning briefing\nDaily requirements calendar is not configured yet, so I can't check day-specific requirements."
    });
    expect(providerCalled).toBe(false);
  });

  it('falls back to a neutral requirements summary when the AI response has an invalid item shape', async () => {
    await expect(
      createAiMorningBriefing({
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
        ],
        provider: async ({ sources }) => ({
          shouldSend: true,
          headline: 'One thing to prep',
          routineItems: [
            {
              text: 'memberA needs sports gear.',
              kind: 'important',
              tags: ['bring'],
              sourceIds: [sources[0]?.sourceId ?? 'missing-source']
            }
          ],
          importantItems: [],
          timingNotes: [],
          uncertaintyNotes: [],
          sourceIdsIgnored: []
        })
      })
    ).resolves.toMatchObject({
      generationStatus: 'fallback',
      sourceIds: ['requirements-calendar:requirements-1:1781218800000'],
      message: "Morning briefing\nToday's requirements\nPack / bring\n- memberA: Bring sports bag"
    });
  });

  it('logs and falls back to a neutral requirements summary when the AI provider fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      createAiMorningBriefing({
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
        ],
        provider: async () => {
          throw new Error('provider unavailable');
        }
      })
    ).resolves.toMatchObject({
      generationStatus: 'fallback',
      sourceIds: ['requirements-calendar:requirements-1:1781218800000'],
      message: "Morning briefing\nToday's requirements\nPack / bring\n- memberA: Bring sports bag"
    });

    expect(errorSpy).toHaveBeenCalledWith(
      '[briefing.ai] Falling back after morning briefing AI provider failure',
      expect.objectContaining({
        localDate,
        timeZone,
        sourceCount: 1,
        requirementSourceCount: 1,
        scheduleSourceCount: 0,
        error: expect.objectContaining({
          message: 'provider unavailable'
        })
      })
    );

    errorSpy.mockRestore();
  });

  it('falls back when AI source references are not valid known source IDs', async () => {
    await expect(
      createAiMorningBriefing({
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
        ],
        provider: async () => ({
          shouldSend: true,
          headline: 'One thing to prep',
          routineItems: [
            {
              text: 'memberA needs sports gear.',
              kind: 'routine',
              tags: ['bring'],
              sourceIds: ['requirements-calendar:requirements-1:1781218800000', 123]
            }
          ],
          importantItems: [],
          timingNotes: [],
          uncertaintyNotes: [],
          sourceIdsIgnored: []
        })
      })
    ).resolves.toMatchObject({
      generationStatus: 'fallback',
      message: "Morning briefing\nToday's requirements\nPack / bring\n- memberA: Bring sports bag"
    });
  });

  it('falls back to deterministic quiet output when AI suppresses an empty weekday', async () => {
    await expect(
      createAiMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: [],
        provider: async () => ({
          shouldSend: false,
          headline: '',
          routineItems: [],
          importantItems: [],
          timingNotes: [],
          uncertaintyNotes: [],
          sourceIdsIgnored: []
        })
      })
    ).resolves.toMatchObject({
      generationStatus: 'deterministic',
      sourceIds: [],
      briefing: {
        shouldSend: true,
        headline: 'Normal day. No special requirements found.'
      },
      message: 'Morning briefing\nNormal day. No special requirements found.'
    });
  });

  it('allows AI to suppress an empty weekend briefing', async () => {
    await expect(
      createAiMorningBriefing({
        localDate: '2026-06-13',
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: [],
        provider: async () => ({
          shouldSend: false,
          headline: '',
          routineItems: [],
          importantItems: [],
          timingNotes: [],
          uncertaintyNotes: [],
          sourceIdsIgnored: []
        })
      })
    ).resolves.toMatchObject({
      generationStatus: 'ai',
      sourceIds: [],
      briefing: {
        shouldSend: false,
        headline: ''
      },
      message: ''
    });
  });
});

describe('morningBriefingSystemPrompt', () => {
  it('instructs the model to compress noise into readiness groups', () => {
    expect(morningBriefingSystemPrompt).toContain('Group the day by household readiness');
    expect(morningBriefingSystemPrompt).toContain('merge duplicate obligations');
    expect(morningBriefingSystemPrompt).toContain('Convert events into responsibilities');
    expect(morningBriefingSystemPrompt).toContain('Use importantItems only for watchouts');
    expect(morningBriefingSystemPrompt).toContain('Use timingNotes only for logistics');
  });
});

describe('createOpenAiMorningBriefingProvider', () => {
  it('requests a strict structured morning briefing and parses the JSON response', async () => {
    const requests: unknown[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  shouldSend: true,
                  headline: 'One thing to prep',
                  routineItems: [],
                  importantItems: [],
                  timingNotes: [],
                  uncertaintyNotes: [],
                  sourceIdsIgnored: []
                })
              }
            }
          ]
        }),
        { status: 200 }
      );
    };

    const provider = createOpenAiMorningBriefingProvider({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl
    });

    await expect(
      provider({
        localDate,
        timeZone,
        sources: [
          {
            sourceId: 'requirements-calendar:requirements-1:1781218800000',
            calendarId: 'requirements-calendar',
            kind: 'dailyRequirements',
            title: 'Sports uniform',
            description: 'Bring sports bag',
            start: Date.parse('2026-06-11T23:00:00.000Z'),
            end: Date.parse('2026-06-12T00:00:00.000Z'),
            allDay: false,
            who: ['memberA'],
            recurring: false
          }
        ]
      })
    ).resolves.toMatchObject({
      shouldSend: true,
      headline: 'One thing to prep'
    });
    expect(requests).toMatchObject([
      {
        model: 'test-model',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'morning_briefing',
            strict: true,
            schema: morningBriefingOutputJsonSchema
          }
        }
      }
    ]);
  });
});
