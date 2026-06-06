import { afterEach, describe, expect, it, vi } from 'vitest';

import { createScheduleReminderRoutes, type ScheduleReminderStore } from './schedule.js';

const nowMs = Date.parse('2026-06-06T10:00:00.000Z');
const eventStart = Date.parse('2026-06-06T10:30:00.000Z');
const eventEnd = Date.parse('2026-06-06T11:00:00.000Z');

function createStore(): ScheduleReminderStore {
  return {
    getDueReminderCandidates: vi.fn(async () => [
      {
        reminderKey: `event-1:${eventStart}:30`,
        googleEventId: 'event-1',
        eventStart,
        eventEnd,
        leadTimeMinutes: 30,
        title: 'School pickup',
        location: 'Main gate'
      }
    ]),
    recordReminderAttempt: vi.fn()
  };
}

function runRequest(token = 'service-token') {
  return new Request('https://bot.example.com/run', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ nowMs })
  });
}

describe('createScheduleReminderRoutes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends due schedule reminders and records sent attempts', async () => {
    const store = createStore();
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const routes = createScheduleReminderRoutes({
      serviceToken: 'service-token',
      cronSecret: 'cron-secret',
      recipientUserIds: ['user_123'],
      leadTimeMinutes: 30,
      store,
      sendNotification
    });

    const response = await routes.request(runRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      processed: 1,
      sent: 1,
      skipped: 0,
      failed: 0
    });
    expect(store.getDueReminderCandidates).toHaveBeenCalledWith({
      nowMs,
      leadTimeMinutes: 30
    });
    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_123',
      topic: 'schedule.reminder',
      message: 'Reminder: School pickup starts at 8:30 pm.\nLocation: Main gate',
      metadata: {
        reminderKey: `event-1:${eventStart}:30`,
        googleEventId: 'event-1'
      }
    });
    expect(store.recordReminderAttempt).toHaveBeenCalledWith({
      reminderKey: `event-1:${eventStart}:30`,
      googleEventId: 'event-1',
      eventStart,
      leadTimeMinutes: 30,
      attemptedAt: nowMs,
      status: 'sent'
    });
  });

  it('allows Vercel cron GET requests with cron bearer auth', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);
    const store = createStore();
    const routes = createScheduleReminderRoutes({
      serviceToken: 'service-token',
      cronSecret: 'cron-secret',
      recipientUserIds: ['user_123'],
      leadTimeMinutes: 30,
      store,
      sendNotification: vi.fn(async () => ({ status: 'sent' as const }))
    });

    const response = await routes.request('/run', {
      method: 'GET',
      headers: {
        authorization: 'Bearer cron-secret'
      }
    });

    expect(response.status).toBe(200);
    expect(store.getDueReminderCandidates).toHaveBeenCalledWith({
      nowMs,
      leadTimeMinutes: 30
    });
    vi.useRealTimers();
  });

  it('records skipped attempts when no recipients are configured', async () => {
    const store = createStore();
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const routes = createScheduleReminderRoutes({
      serviceToken: 'service-token',
      cronSecret: 'cron-secret',
      recipientUserIds: [],
      leadTimeMinutes: 30,
      store,
      sendNotification
    });

    const response = await routes.request(runRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      processed: 1,
      sent: 0,
      skipped: 1,
      failed: 0
    });
    expect(sendNotification).not.toHaveBeenCalled();
    expect(store.recordReminderAttempt).toHaveBeenCalledWith({
      reminderKey: `event-1:${eventStart}:30`,
      googleEventId: 'event-1',
      eventStart,
      leadTimeMinutes: 30,
      attemptedAt: nowMs,
      status: 'skipped',
      providerErrorCode: 'no_reminder_recipients'
    });
  });
});
