import { describe, expect, it, vi } from 'vitest';

import type { ScheduleEventRow } from '../schedule/mapping';
import type { BotMorningBriefing } from './delivery';
import { createMorningBriefing, renderMorningBriefingDeliveryPreview } from './generation';
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
    rainChancePercent: 20,
    maxWindGustKph: 18,
    maxUvIndex: 2,
    readiness: ['warm layer']
  },
  afternoon: {
    temperatureC: { min: 13, max: 15 },
    apparentTemperatureC: { min: 12, max: 13 },
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
      watchouts: [{ text: 'Homework folder is due back.', who: [], sourceIds: ['requirements-calendar:event-3'] }],
      sourceIdsIgnored: []
    }
  } satisfies BotMorningBriefing;

  it('renders the morning slot from the structured briefing', () => {
    expect(renderMorningBriefingDeliveryPreview({ briefing, members, slot: 'morning' })).toMatchObject({
      message: `Library bag and dancing shoes.

This morning:
- Child A: Pack library bag

Watchouts
- Homework folder is due back.`,
      shouldSend: true
    });
  });

  it('renders the afternoon slot with relevant weather readiness', () => {
    expect(
      renderMorningBriefingDeliveryPreview({
        briefing,
        members,
        slot: 'afternoon',
        weather: {
          ...weather,
          afternoon: {
            ...weather.afternoon,
            readiness: ['rain layer']
          }
        }
      })
    ).toMatchObject({
      message: `This afternoon:
- Child A: Bring dancing shoes

Weather:
- Rain layer may help this afternoon.`,
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
            afternoon: []
          }
        },
        members,
        slot: 'afternoon',
        weather: {
          ...weather,
          afternoon: {
            ...weather.afternoon,
            readiness: ['rain layer']
          }
        }
      })
    ).toMatchObject({
      message: '',
      shouldSend: false
    });
  });
});
