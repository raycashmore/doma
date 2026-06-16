import { describe, expect, it, vi } from 'vitest';

import type { ScheduleEventRow } from '../schedule/mapping';
import { createMorningBriefing } from './generation';

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

describe('createMorningBriefing', () => {
  it('uses deterministic generation when no AI provider is configured', async () => {
    await expect(
      createMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: [event()],
        provider: null
      })
    ).resolves.toMatchObject({
      generationStatus: 'deterministic',
      message: "Today:\nToday's requirements\n\nPack / bring\n- Bring sports bag"
    });
  });

  it('uses the AI provider when one is configured', async () => {
    const provider = vi.fn(async () => ({
      shouldSend: true,
      headline: 'One thing to prep',
      routineItems: [
        {
          text: 'memberA needs sports gear.',
          kind: 'routine',
          tags: ['bring'],
          sourceIds: ['requirements-calendar:event-1:1781218800000']
        }
      ],
      importantItems: [],
      timingNotes: [],
      uncertaintyNotes: [],
      sourceIdsIgnored: []
    }));

    await expect(
      createMorningBriefing({
        localDate,
        timeZone,
        calendarConfigs: [{ calendarId: 'requirements-calendar', who: 'shared', kind: 'dailyRequirements' }],
        events: [event()],
        provider
      })
    ).resolves.toMatchObject({
      generationStatus: 'ai',
      message: 'Today:\nOne thing to prep\n\nPack / bring\n- someone needs sports gear.'
    });
    expect(provider).toHaveBeenCalledOnce();
  });
});
