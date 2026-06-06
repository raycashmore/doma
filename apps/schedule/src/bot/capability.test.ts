import { describe, expect, it } from 'vitest';

import {
  type BotScheduleEvent,
  formatUpcomingEvents,
  handleScheduleCapabilityRequest,
  parseBotCapabilityRequest
} from './capability';

const nowMs = Date.parse('2026-06-06T00:00:00.000Z');
const upcomingEvent: BotScheduleEvent = {
  googleEventId: 'event-1',
  start: Date.parse('2026-06-06T01:30:00.000Z'),
  end: Date.parse('2026-06-06T02:30:00.000Z'),
  allDay: false,
  title: 'School pickup',
  location: 'Main gate'
};

describe('formatUpcomingEvents', () => {
  it('formats upcoming events in time order', () => {
    const laterEvent: BotScheduleEvent = {
      ...upcomingEvent,
      googleEventId: 'event-2',
      start: Date.parse('2026-06-06T04:00:00.000Z'),
      title: 'Dentist'
    };

    expect(formatUpcomingEvents([laterEvent, upcomingEvent], nowMs, 'Australia/Sydney')).toBe(
      [
        'Upcoming events:',
        '- Sat, 6 June, 11:30 am: School pickup (Main gate)',
        '- Sat, 6 June, 2:00 pm: Dentist (Main gate)'
      ].join('\n')
    );
  });

  it('returns an empty-state reply when there are no upcoming events', () => {
    expect(formatUpcomingEvents([], nowMs, 'Australia/Sydney')).toBe(
      'No upcoming events found for the current schedule window.'
    );
  });

  it('formats all-day events without a time', () => {
    expect(formatUpcomingEvents([{ ...upcomingEvent, allDay: true }], nowMs, 'Australia/Sydney')).toBe(
      'Upcoming events:\n- Sat, 6 June: School pickup (Main gate)'
    );
  });
});

describe('handleScheduleCapabilityRequest', () => {
  it('answers /schedule upcoming with loaded schedule data', async () => {
    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'schedule',
          messageText: '/schedule upcoming',
          receivedAt: nowMs
        },
        {
          nowMs,
          timeZone: 'Australia/Sydney',
          loadCurrentWeek: async () => ({ events: [upcomingEvent] })
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: 'Upcoming events:\n- Sat, 6 June, 11:30 am: School pickup (Main gate)'
    });
  });

  it('returns command help for unsupported schedule asks', async () => {
    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'schedule',
          messageText: '/schedule budget',
          receivedAt: nowMs
        },
        {
          loadCurrentWeek: async () => ({ events: [] })
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: 'Try /schedule upcoming to see the next events.'
    });
  });
});

describe('parseBotCapabilityRequest', () => {
  it('accepts the provider-neutral capability request shape', () => {
    expect(
      parseBotCapabilityRequest({
        userId: 'user_123',
        command: 'schedule',
        messageText: '/schedule upcoming',
        receivedAt: nowMs
      })
    ).toEqual({
      userId: 'user_123',
      command: 'schedule',
      messageText: '/schedule upcoming',
      receivedAt: nowMs
    });
  });

  it('rejects malformed capability requests', () => {
    expect(parseBotCapabilityRequest({ messageText: '/schedule upcoming' })).toBeNull();
  });
});
