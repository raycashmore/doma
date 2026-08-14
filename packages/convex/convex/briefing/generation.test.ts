import { describe, expect, it, vi } from 'vitest';

import type { ScheduleEventRow } from '../schedule/mapping';
import type { BotMorningBriefing } from './delivery';
import {
  createMorningBriefing,
  renderBotMorningBriefingForReplay,
  renderMorningBriefingDeliveryPreview
} from './generation';
import type { MorningBriefingWeatherContext } from './weather';

const localDate = '2026-06-12';
const timeZone = 'Australia/Sydney';

function event(overrides: Partial<ScheduleEventRow> = {}): ScheduleEventRow {
  return {
    googleEventId: 'event-1',
    calendarId: 'requirements-calendar',
    kind: 'dailyRequirements',
    start: Date.parse('2026-06-11T23:00:00.000Z'),
    end: Date.parse('2026-06-12T00:00:00.000Z'),
    allDay: false,
    title: 'Sports uniform',
    description: 'Bring sports bag',
    who: ['memberA'],
    recurring: false,
    htmlLink: 'https://calendar.example/events/event-1',
    ...overrides
  };
}

const members = [
  { id: 'childA', label: 'Child A', initials: 'CA' },
  { id: 'adultA', label: 'Adult A', initials: 'AA' }
];

const weather: MorningBriefingWeatherContext = {
  summary: 'Cold morning.',
  morning: {
    temperatureC: { min: 8, max: 11 },
    apparentTemperatureC: { min: 6, max: 9 },
    relativeHumidityPercent: { min: 64, max: 68 },
    rainChancePercent: 20,
    maxWindGustKph: 18,
    maxUvIndex: 2,
    readiness: ['warm layer']
  },
  afternoon: {
    temperatureC: { min: 13, max: 15 },
    apparentTemperatureC: { min: 12, max: 13 },
    relativeHumidityPercent: { min: 58, max: 62 },
    rainChancePercent: 40,
    maxWindGustKph: 24,
    maxUvIndex: 4,
    readiness: []
  }
};

describe('createMorningBriefing', () => {
  it('uses deterministic generation when no AI provider is configured', async () => {
    await expect(
      createMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: [event()],
        provider: null,
        members
      })
    ).resolves.toMatchObject({
      generationStatus: 'deterministic',
      message: "Today:\nToday's requirements\n\nThis morning:\n- memberA: Bring sports bag"
    });
  });

  it('uses the AI provider when one is configured', async () => {
    const provider = vi.fn(async () => ({
      shouldSend: true,
      headline: 'One thing to prep',
      morning: [
        {
          text: 'Needs sports gear.',
          who: ['childA'],
          sourceIds: ['requirements-calendar:event-1:1781218800000']
        }
      ],
      afternoon: [],
      watchouts: [],
      sourceIdsIgnored: []
    }));

    await expect(
      createMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: [event()],
        provider,
        members
      })
    ).resolves.toMatchObject({
      generationStatus: 'ai',
      message: 'Today:\nOne thing to prep\n\nThis morning:\n- Child A: Needs sports gear.'
    });
    expect(provider).toHaveBeenCalledOnce();
  });

  it('passes weather context through to AI generation', async () => {
    const provider = vi.fn(async () => ({
      shouldSend: true,
      headline: 'Cold start for the sports bag day.',
      morning: [
        {
          text: 'Needs sports gear.',
          who: ['childA'],
          sourceIds: ['requirements-calendar:event-1:1781218800000']
        }
      ],
      afternoon: [],
      watchouts: [],
      sourceIdsIgnored: []
    }));

    await createMorningBriefing({
      localDate,
      timeZone,
      calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
      events: [event()],
      provider,
      members,
      weather
    });

    expect(provider).toHaveBeenCalledWith(expect.objectContaining({ weather }));
  });
});

describe('renderMorningBriefingDeliveryPreview', () => {
  const briefing = {
    briefingKey: 'morning:2026-06-12',
    localDate,
    generationStatus: 'ai',
    shouldSend: true,
    message:
      'Today:\nLibrary bag and dancing shoes.\n\nThis morning:\n- Child A: Pack library bag\n\nThis afternoon:\n- Child A: Bring dancing shoes',
    briefing: {
      shouldSend: true,
      headline: 'Library bag and dancing shoes.',
      morning: [{ text: 'Pack library bag', who: ['childA'], sourceIds: ['requirements-calendar:event-1'] }],
      afternoon: [{ text: 'Bring dancing shoes', who: ['childA'], sourceIds: ['requirements-calendar:event-2'] }],
      watchouts: [
        {
          text: 'Pickup timing has changed.',
          who: [],
          sourceIds: ['schedule-calendar:event-3'],
          afternoonEligible: true
        }
      ],
      sourceIdsIgnored: []
    }
  } satisfies BotMorningBriefing;

  it('renders the whole day and headline in the morning slot', () => {
    expect(renderMorningBriefingDeliveryPreview({ briefing, members, slot: 'morning' })).toMatchObject({
      message: `Today:
Library bag and dancing shoes.

This morning:
- Child A: Pack library bag

This afternoon:
- Child A: Bring dancing shoes

Watchouts
- Pickup timing has changed.`,
      shouldSend: true
    });
  });

  it('does not let a weather headline create a morning preview by itself', () => {
    expect(
      renderMorningBriefingDeliveryPreview({
        briefing: {
          ...briefing,
          briefing: {
            ...briefing.briefing,
            headline: 'Cold and humid this morning.',
            morning: [],
            afternoon: [],
            watchouts: []
          }
        },
        members,
        slot: 'morning'
      })
    ).toMatchObject({
      message: '',
      shouldSend: false
    });
  });

  it('renders only unusual watchouts in the afternoon slot', () => {
    expect(
      renderMorningBriefingDeliveryPreview({
        briefing,
        members,
        slot: 'afternoon'
      })
    ).toMatchObject({
      message: `Watchouts
- Pickup timing has changed.`,
      shouldSend: true
    });
  });

  it('does not let afternoon weather create a preview by itself', () => {
    expect(
      renderMorningBriefingDeliveryPreview({
        briefing: {
          ...briefing,
          briefing: {
            ...briefing.briefing,
            morning: [{ text: 'Pack library bag', who: ['childA'], sourceIds: ['requirements-calendar:event-1'] }],
            afternoon: [],
            watchouts: []
          }
        },
        members,
        slot: 'afternoon'
      })
    ).toMatchObject({
      message: '',
      shouldSend: false
    });
  });
});

describe('renderBotMorningBriefingForReplay', () => {
  it('rebuilds replay text as the complete morning delivery', () => {
    const briefing = {
      briefingKey: 'morning:2026-06-12',
      localDate,
      generationStatus: 'ai',
      shouldSend: true,
      message:
        'Today:\nA tidy split today: <b>library</b> and Crazy Hair &amp; Sock Day.\n\nThis morning:\n- Child A: School run needs <b>library</b> bag and Crazy Hair &amp; Sock Day.',
      briefing: {
        shouldSend: true,
        headline: 'A tidy split today: library and Crazy Hair & Sock Day.',
        morning: [
          {
            text: 'School run needs library bag and Crazy Hair & Sock Day.',
            who: ['childA'],
            sourceIds: ['requirements-calendar:event-1']
          }
        ],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      }
    } satisfies BotMorningBriefing;

    expect(renderBotMorningBriefingForReplay({ briefing, members })).toMatchObject({
      message: `Today:
A tidy split today: library and Crazy Hair & Sock Day.

This morning:
- Child A: School run needs library bag and Crazy Hair & Sock Day.`
    });
  });

  it('rejects replay from dirty structured briefing content instead of stripping it', () => {
    const briefing = {
      briefingKey: 'morning:2026-06-12',
      localDate,
      generationStatus: 'ai',
      shouldSend: true,
      message: 'Today:\nA tidy split today.',
      briefing: {
        shouldSend: true,
        headline: 'A tidy split today: <b>library</b> and Crazy Hair &amp; Sock Day.',
        morning: [],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      }
    } satisfies BotMorningBriefing;

    expect(renderBotMorningBriefingForReplay({ briefing, members })).toBeNull();
  });

  it('rejects replay from clean text with unknown structured ownership', () => {
    const briefing = {
      briefingKey: 'morning:2026-06-12',
      localDate,
      generationStatus: 'ai',
      shouldSend: true,
      message: 'Today:\nLibrary day.\n\nThis morning:\n- memberC: Bring library bag.',
      briefing: {
        shouldSend: true,
        headline: 'Library day.',
        morning: [{ text: 'Bring library bag.', who: ['memberC'], sourceIds: ['requirements-calendar:event-1'] }],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      }
    } satisfies BotMorningBriefing;

    expect(renderBotMorningBriefingForReplay({ briefing, members })).toBeNull();
  });
});
