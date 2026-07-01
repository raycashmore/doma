import { describe, expect, it, vi } from 'vitest';

import {
  type BotMorningBriefing,
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
  it("replays today's stored morning briefing for /briefing and marks the recipient delivered", async () => {
    const briefing: BotMorningBriefing = {
      briefingKey: 'morning:2026-06-06',
      localDate: '2026-06-06',
      message: 'Morning briefing\nNormal day. No special requirements found.',
      shouldSend: true,
      generationStatus: 'deterministic'
    };
    const markMorningBriefingDelivered = vi.fn(async () => undefined);

    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'briefing',
          messageText: '/briefing',
          receivedAt: nowMs
        },
        {
          nowMs,
          timeZone: 'Australia/Sydney',
          loadCurrentWeek: async () => ({ events: [] }),
          loadMorningBriefing: async () => briefing,
          generateMorningBriefing: async () => {
            throw new Error('should not regenerate an existing briefing');
          },
          markMorningBriefingDelivered
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: 'Morning briefing\nNormal day. No special requirements found.'
    });
    expect(markMorningBriefingDelivered).toHaveBeenCalledWith({
      briefingKey: 'morning:2026-06-06',
      recipientUserId: 'user_123',
      attemptedAt: nowMs
    });
  });

  it("generates today's morning briefing on demand when none is stored", async () => {
    const briefing: BotMorningBriefing = {
      briefingKey: 'morning:2026-06-06',
      localDate: '2026-06-06',
      message: "Morning briefing\nToday's requirements\nPack / bring\n- memberA: Bring sports bag",
      shouldSend: true,
      generationStatus: 'ai'
    };
    const generateMorningBriefing = vi.fn(async () => briefing);
    const markMorningBriefingDelivered = vi.fn(async () => undefined);

    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'briefing',
          messageText: '/briefing',
          receivedAt: nowMs
        },
        {
          nowMs,
          timeZone: 'Australia/Sydney',
          loadCurrentWeek: async () => ({ events: [] }),
          loadMorningBriefing: async () => null,
          generateMorningBriefing,
          markMorningBriefingDelivered
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: "Morning briefing\nToday's requirements\nPack / bring\n- memberA: Bring sports bag"
    });
    expect(generateMorningBriefing).toHaveBeenCalledWith({
      localDate: '2026-06-06',
      timeZone: 'Australia/Sydney',
      generatedAt: nowMs
    });
    expect(markMorningBriefingDelivered).toHaveBeenCalledWith({
      briefingKey: 'morning:2026-06-06',
      recipientUserId: 'user_123',
      attemptedAt: nowMs
    });
  });

  it('returns a briefing-specific fallback when on-demand generation fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'briefing',
          messageText: '/briefing',
          receivedAt: nowMs
        },
        {
          nowMs,
          timeZone: 'Australia/Sydney',
          loadCurrentWeek: async () => ({ events: [] }),
          loadMorningBriefing: async () => null,
          generateMorningBriefing: async () => {
            throw new Error('convex action failed');
          },
          markMorningBriefingDelivered: async () => undefined
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: 'I could not load the morning briefing just now.'
    });

    expect(errorSpy).toHaveBeenCalledWith(
      '[schedule.bot] Morning briefing request failed',
      expect.objectContaining({
        localDate: '2026-06-06',
        error: expect.objectContaining({
          message: 'convex action failed'
        })
      })
    );

    errorSpy.mockRestore();
  });

  it('replays a stored fallback briefing without regenerating it', async () => {
    const generateMorningBriefing = vi.fn(async () => {
      throw new Error('should not regenerate a stored fallback');
    });

    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'briefing',
          messageText: '/briefing',
          receivedAt: nowMs
        },
        {
          nowMs,
          timeZone: 'Australia/Sydney',
          loadCurrentWeek: async () => ({ events: [] }),
          loadMorningBriefing: async () => ({
            briefingKey: 'morning:2026-06-06',
            localDate: '2026-06-06',
            message: 'Morning briefing\nNo daily requirements found.',
            shouldSend: true,
            generationStatus: 'fallback'
          }),
          generateMorningBriefing,
          markMorningBriefingDelivered: async () => undefined
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: 'Morning briefing\nNo daily requirements found.'
    });
    expect(generateMorningBriefing).not.toHaveBeenCalled();
  });

  it('aliases /schedule briefing to the morning briefing behavior', async () => {
    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'schedule',
          messageText: '/schedule briefing',
          receivedAt: nowMs
        },
        {
          nowMs,
          timeZone: 'Australia/Sydney',
          loadCurrentWeek: async () => ({ events: [] }),
          loadMorningBriefing: async () => ({
            briefingKey: 'morning:2026-06-06',
            localDate: '2026-06-06',
            message: 'Morning briefing\nNormal day. No special requirements found.',
            shouldSend: true,
            generationStatus: 'deterministic'
          }),
          generateMorningBriefing: async () => {
            throw new Error('should not regenerate an existing briefing');
          },
          markMorningBriefingDelivered: async () => undefined
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: 'Morning briefing\nNormal day. No special requirements found.'
    });
  });

  it('renders the morning delivery preview for /schedule briefing morning without recording delivery', async () => {
    const loadMorningBriefingDeliveryPreview = vi.fn(async () => ({
      briefingKey: 'morning:2026-06-06',
      localDate: '2026-06-06',
      message: 'Sport clothes today.\n\nThis morning:\n- Child A: Bring sport bag',
      shouldSend: true,
      generationStatus: 'deterministic' as const
    }));
    const markMorningBriefingDelivered = vi.fn(async () => undefined);

    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'schedule',
          messageText: '/schedule briefing morning',
          receivedAt: nowMs
        },
        {
          nowMs,
          timeZone: 'Australia/Sydney',
          loadCurrentWeek: async () => ({ events: [] }),
          loadMorningBriefingDeliveryPreview,
          markMorningBriefingDelivered
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: 'Sport clothes today.\n\nThis morning:\n- Child A: Bring sport bag'
    });

    expect(loadMorningBriefingDeliveryPreview).toHaveBeenCalledWith({
      localDate: '2026-06-06',
      timeZone: 'Australia/Sydney',
      generatedAt: nowMs,
      slot: 'morning'
    });
    expect(markMorningBriefingDelivered).not.toHaveBeenCalled();
  });

  it('renders the morning delivery preview for /briefing morning without recording delivery', async () => {
    const loadMorningBriefingDeliveryPreview = vi.fn(async () => ({
      briefingKey: 'morning:2026-06-06',
      localDate: '2026-06-06',
      message: 'Library bag today.\n\nThis morning:\n- Child A: Bring library bag',
      shouldSend: true,
      generationStatus: 'deterministic' as const
    }));
    const markMorningBriefingDelivered = vi.fn(async () => undefined);

    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'briefing',
          messageText: '/briefing morning',
          receivedAt: nowMs
        },
        {
          nowMs,
          timeZone: 'Australia/Sydney',
          loadCurrentWeek: async () => ({ events: [] }),
          loadMorningBriefingDeliveryPreview,
          markMorningBriefingDelivered
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: 'Library bag today.\n\nThis morning:\n- Child A: Bring library bag'
    });

    expect(loadMorningBriefingDeliveryPreview).toHaveBeenCalledWith({
      localDate: '2026-06-06',
      timeZone: 'Australia/Sydney',
      generatedAt: nowMs,
      slot: 'morning'
    });
    expect(markMorningBriefingDelivered).not.toHaveBeenCalled();
  });

  it('renders an empty-state reply for a quiet afternoon delivery preview', async () => {
    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'schedule',
          messageText: '/schedule briefing afternoon',
          receivedAt: nowMs
        },
        {
          nowMs,
          timeZone: 'Australia/Sydney',
          loadCurrentWeek: async () => ({ events: [] }),
          loadMorningBriefingDeliveryPreview: async () => ({
            briefingKey: 'morning:2026-06-06',
            localDate: '2026-06-06',
            message: '',
            shouldSend: false,
            generationStatus: 'deterministic'
          })
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: 'Nothing to flag this afternoon.'
    });
  });

  it('renders an empty-state reply for a quiet /briefing afternoon delivery preview', async () => {
    const loadMorningBriefingDeliveryPreview = vi.fn(async () => ({
      briefingKey: 'morning:2026-06-06',
      localDate: '2026-06-06',
      message: '',
      shouldSend: false,
      generationStatus: 'deterministic' as const
    }));

    await expect(
      handleScheduleCapabilityRequest(
        {
          userId: 'user_123',
          command: 'briefing',
          messageText: '/briefing afternoon',
          receivedAt: nowMs
        },
        {
          nowMs,
          timeZone: 'Australia/Sydney',
          loadCurrentWeek: async () => ({ events: [] }),
          loadMorningBriefingDeliveryPreview
        }
      )
    ).resolves.toEqual({
      kind: 'reply',
      text: 'Nothing to flag this afternoon.'
    });

    expect(loadMorningBriefingDeliveryPreview).toHaveBeenCalledWith({
      localDate: '2026-06-06',
      timeZone: 'Australia/Sydney',
      generatedAt: nowMs,
      slot: 'afternoon'
    });
  });

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
