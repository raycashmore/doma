import { afterEach, describe, expect, it, vi } from 'vitest';

import { createConvexScheduleReminderStore } from './convexStore.js';

describe('createConvexScheduleReminderStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads due reminder candidates from Convex using service auth args', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        status: 'success',
        value: [
          {
            reminderKey: 'event-1:1000:30',
            googleEventId: 'event-1',
            eventStart: 1000,
            eventEnd: 2000,
            leadTimeMinutes: 30,
            title: 'School pickup'
          }
        ]
      })
    );
    vi.stubGlobal('fetch', fetch);
    const store = createConvexScheduleReminderStore({
      convexUrl: 'https://convex.example.com',
      serviceToken: 'service-token'
    });

    await expect(store.getDueReminderCandidates({ nowMs: 700, leadTimeMinutes: 30 })).resolves.toEqual([
      {
        reminderKey: 'event-1:1000:30',
        googleEventId: 'event-1',
        eventStart: 1000,
        eventEnd: 2000,
        leadTimeMinutes: 30,
        title: 'School pickup'
      }
    ]);
    expect(fetch).toHaveBeenCalledWith(
      'https://convex.example.com/api/query',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          path: 'schedule/reminders:dueReminderCandidates',
          format: 'convex_encoded_json',
          args: [
            {
              serviceToken: 'service-token',
              nowMs: 700,
              leadTimeMinutes: 30
            }
          ]
        })
      })
    );
  });

  it('records reminder attempts through the Convex mutation endpoint', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        status: 'success',
        value: { inserted: true, id: 'attempt-1' }
      })
    );
    vi.stubGlobal('fetch', fetch);
    const store = createConvexScheduleReminderStore({
      convexUrl: 'https://convex.example.com',
      serviceToken: 'service-token'
    });

    await store.recordReminderAttempt({
      reminderKey: 'event-1:1000:30',
      googleEventId: 'event-1',
      eventStart: 1000,
      leadTimeMinutes: 30,
      attemptedAt: 700,
      status: 'sent'
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://convex.example.com/api/mutation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          path: 'schedule/reminders:recordReminderAttempt',
          format: 'convex_encoded_json',
          args: [
            {
              serviceToken: 'service-token',
              reminderKey: 'event-1:1000:30',
              googleEventId: 'event-1',
              eventStart: 1000,
              leadTimeMinutes: 30,
              attemptedAt: 700,
              status: 'sent'
            }
          ]
        })
      })
    );
  });
});
