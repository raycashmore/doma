import { describe, expect, it, vi } from 'vitest';

import {
  createBotGatewayNotificationSender,
  getDueReminderCandidates,
  type ReminderEvent,
  reminderKeyForEvent,
  runScheduleReminderCycle
} from './reminders';

const nowMs = Date.parse('2026-06-06T10:00:00.000Z');

function event(overrides: Partial<ReminderEvent> = {}): ReminderEvent {
  return {
    googleEventId: 'event-1',
    start: nowMs + 30 * 60_000,
    end: nowMs + 60 * 60_000,
    allDay: false,
    title: 'School pickup',
    ...overrides
  };
}

describe('reminderKeyForEvent', () => {
  it('builds a stable key from event identity, start, and lead time', () => {
    expect(reminderKeyForEvent(event(), 30)).toBe(`event-1:${nowMs + 30 * 60_000}:30`);
  });
});

describe('getDueReminderCandidates', () => {
  it('returns no candidates when there are no events', () => {
    expect(
      getDueReminderCandidates({
        events: [],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30
      })
    ).toEqual([]);
  });

  it('returns due events within the reminder window', () => {
    expect(
      getDueReminderCandidates({
        events: [event({ location: 'Main gate' })],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30
      })
    ).toEqual([
      {
        reminderKey: `event-1:${nowMs + 30 * 60_000}:30`,
        googleEventId: 'event-1',
        eventStart: nowMs + 30 * 60_000,
        eventEnd: nowMs + 60 * 60_000,
        leadTimeMinutes: 30,
        title: 'School pickup',
        location: 'Main gate'
      }
    ]);
  });

  it('does not return events before they are due', () => {
    expect(
      getDueReminderCandidates({
        events: [event({ start: nowMs + 45 * 60_000 })],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30
      })
    ).toEqual([]);
  });

  it('does not return already attempted events', () => {
    const candidate = event();
    expect(
      getDueReminderCandidates({
        events: [candidate],
        attempts: [{ reminderKey: reminderKeyForEvent(candidate, 30) }],
        nowMs,
        leadTimeMinutes: 30
      })
    ).toEqual([]);
  });

  it('does not return stale reminder windows', () => {
    expect(
      getDueReminderCandidates({
        events: [event({ start: nowMs + 15 * 60_000 })],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30,
        lookbackMs: 5 * 60_000
      })
    ).toEqual([]);
  });
});

describe('runScheduleReminderCycle', () => {
  it('does not send or record reminders before 6am in the configured timezone', async () => {
    const sendNotification = vi.fn();
    const recordReminderAttempt = vi.fn();

    await expect(
      runScheduleReminderCycle({
        events: [event()],
        attempts: [],
        nowMs: Date.parse('2026-06-05T19:59:00.000Z'), // 5:59am in Australia/Sydney
        leadTimeMinutes: 30,
        lookbackMs: 30 * 60_000,
        timeZone: 'Australia/Sydney',
        recipientUserIds: ['user_123'],
        sendNotification,
        recordReminderAttempt
      })
    ).resolves.toEqual({
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      outsideDeliveryWindow: true
    });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordReminderAttempt).not.toHaveBeenCalled();
  });

  it('does not send or record reminders at or after 10pm in the configured timezone', async () => {
    const sendNotification = vi.fn();
    const recordReminderAttempt = vi.fn();

    await expect(
      runScheduleReminderCycle({
        events: [event()],
        attempts: [],
        nowMs: Date.parse('2026-06-06T12:00:00.000Z'), // 10:00pm in Australia/Sydney
        leadTimeMinutes: 30,
        lookbackMs: 30 * 60_000,
        timeZone: 'Australia/Sydney',
        recipientUserIds: ['user_123'],
        sendNotification,
        recordReminderAttempt
      })
    ).resolves.toEqual({
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      outsideDeliveryWindow: true
    });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordReminderAttempt).not.toHaveBeenCalled();
  });

  it('sends due reminders inside the configured delivery window and records sent attempts', async () => {
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordReminderAttempt = vi.fn();

    await expect(
      runScheduleReminderCycle({
        events: [event({ location: 'Main gate' })],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30,
        lookbackMs: 30 * 60_000,
        timeZone: 'Australia/Sydney',
        recipientUserIds: ['user_123'],
        sendNotification,
        recordReminderAttempt
      })
    ).resolves.toEqual({
      processed: 1,
      sent: 1,
      skipped: 0,
      failed: 0,
      outsideDeliveryWindow: false
    });

    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_123',
      topic: 'schedule.reminder',
      message: 'Reminder: School pickup starts at 8:30 pm.\nLocation: Main gate',
      metadata: {
        reminderKey: `event-1:${nowMs + 30 * 60_000}:30`,
        googleEventId: 'event-1'
      }
    });
    expect(recordReminderAttempt).toHaveBeenCalledWith({
      reminderKey: `event-1:${nowMs + 30 * 60_000}:30`,
      googleEventId: 'event-1',
      eventStart: nowMs + 30 * 60_000,
      leadTimeMinutes: 30,
      attemptedAt: nowMs,
      status: 'sent'
    });
  });

  it('records skipped attempts when no reminder recipients are configured', async () => {
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordReminderAttempt = vi.fn();

    await expect(
      runScheduleReminderCycle({
        events: [event()],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30,
        lookbackMs: 30 * 60_000,
        timeZone: 'Australia/Sydney',
        recipientUserIds: [],
        sendNotification,
        recordReminderAttempt
      })
    ).resolves.toEqual({
      processed: 1,
      sent: 0,
      skipped: 1,
      failed: 0,
      outsideDeliveryWindow: false
    });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordReminderAttempt).toHaveBeenCalledWith({
      reminderKey: `event-1:${nowMs + 30 * 60_000}:30`,
      googleEventId: 'event-1',
      eventStart: nowMs + 30 * 60_000,
      leadTimeMinutes: 30,
      attemptedAt: nowMs,
      status: 'skipped',
      providerErrorCode: 'no_reminder_recipients'
    });
  });

  it('records failed attempts when delivery fails', async () => {
    const sendNotification = vi.fn(async () => ({ status: 'failed' as const, errorCode: 'bot_gateway_unavailable' }));
    const recordReminderAttempt = vi.fn();

    await expect(
      runScheduleReminderCycle({
        events: [event()],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30,
        lookbackMs: 30 * 60_000,
        timeZone: 'Australia/Sydney',
        recipientUserIds: ['user_123'],
        sendNotification,
        recordReminderAttempt
      })
    ).resolves.toEqual({
      processed: 1,
      sent: 0,
      skipped: 0,
      failed: 1,
      outsideDeliveryWindow: false
    });

    expect(recordReminderAttempt).toHaveBeenCalledWith({
      reminderKey: `event-1:${nowMs + 30 * 60_000}:30`,
      googleEventId: 'event-1',
      eventStart: nowMs + 30 * 60_000,
      leadTimeMinutes: 30,
      attemptedAt: nowMs,
      status: 'failed',
      providerErrorCode: 'bot_gateway_unavailable'
    });
  });

  it('does not send or record already-attempted reminders', async () => {
    const candidate = event();
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordReminderAttempt = vi.fn();

    await expect(
      runScheduleReminderCycle({
        events: [candidate],
        attempts: [{ reminderKey: reminderKeyForEvent(candidate, 30) }],
        nowMs,
        leadTimeMinutes: 30,
        lookbackMs: 30 * 60_000,
        timeZone: 'Australia/Sydney',
        recipientUserIds: ['user_123'],
        sendNotification,
        recordReminderAttempt
      })
    ).resolves.toEqual({
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      outsideDeliveryWindow: false
    });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordReminderAttempt).not.toHaveBeenCalled();
  });
});

describe('createBotGatewayNotificationSender', () => {
  const notification = {
    recipientUserId: 'user_123',
    topic: 'schedule.reminder' as const,
    message: 'Reminder text',
    metadata: { reminderKey: 'event-1:1000:30', googleEventId: 'event-1' }
  };

  it('posts notifications to the api-bot delivery boundary with service auth', async () => {
    const fetch = vi.fn(async () => Response.json({ status: 'sent', provider: 'telegram' }));
    vi.stubGlobal('fetch', fetch);
    const sendNotification = createBotGatewayNotificationSender({
      botGatewayOrigin: 'https://bot.example.com',
      serviceToken: 'service-token'
    });

    await expect(sendNotification(notification)).resolves.toEqual({ status: 'sent' });

    expect(fetch).toHaveBeenCalledWith('https://bot.example.com/notifications/send', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify(notification)
    });
    vi.unstubAllGlobals();
  });

  it('maps non-2xx api-bot responses to failed delivery results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'unauthorized' }, { status: 401 }))
    );
    const sendNotification = createBotGatewayNotificationSender({
      botGatewayOrigin: 'https://bot.example.com',
      serviceToken: 'service-token'
    });

    await expect(sendNotification(notification)).resolves.toEqual({
      status: 'failed',
      errorCode: 'bot_gateway_http_401'
    });
    vi.unstubAllGlobals();
  });

  it('maps malformed api-bot responses to failed delivery results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not json', { status: 200 }))
    );
    const sendNotification = createBotGatewayNotificationSender({
      botGatewayOrigin: 'https://bot.example.com',
      serviceToken: 'service-token'
    });

    await expect(sendNotification(notification)).resolves.toEqual({
      status: 'failed',
      errorCode: 'bot_gateway_invalid_response'
    });
    vi.unstubAllGlobals();
  });

  it('maps network errors to failed delivery results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );
    const sendNotification = createBotGatewayNotificationSender({
      botGatewayOrigin: 'https://bot.example.com',
      serviceToken: 'service-token'
    });

    await expect(sendNotification(notification)).resolves.toEqual({
      status: 'failed',
      errorCode: 'bot_gateway_network_error'
    });
    vi.unstubAllGlobals();
  });
});
