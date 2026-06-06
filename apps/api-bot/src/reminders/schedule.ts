import { Hono } from 'hono';
import { z } from 'zod';

import { isAuthorizedServiceRequest } from '../auth/serviceAuth.js';
import { jsonError, jsonOk } from '../http/json.js';

export type DueScheduleReminder = {
  reminderKey: string;
  googleEventId: string;
  eventStart: number;
  eventEnd: number;
  leadTimeMinutes: number;
  title: string;
  location?: string;
};

export type ScheduleReminderAttemptStatus = 'sent' | 'skipped' | 'failed';

export type ScheduleReminderStore = {
  getDueReminderCandidates: (request: {
    nowMs: number;
    leadTimeMinutes: number;
  }) => Promise<DueScheduleReminder[]>;
  recordReminderAttempt: (attempt: {
    reminderKey: string;
    googleEventId: string;
    eventStart: number;
    leadTimeMinutes: number;
    attemptedAt: number;
    status: ScheduleReminderAttemptStatus;
    providerErrorCode?: string;
  }) => Promise<unknown>;
};

export type ScheduleReminderNotificationSender = (notification: {
  recipientUserId: string;
  topic: 'schedule.reminder';
  message: string;
  metadata: Record<string, string>;
}) => Promise<{ status: ScheduleReminderAttemptStatus; errorCode?: string }>;

export type CreateScheduleReminderRoutesOptions = {
  serviceToken: string;
  recipientUserIds: string[];
  leadTimeMinutes: number;
  timeZone?: string;
  store: ScheduleReminderStore;
  sendNotification: ScheduleReminderNotificationSender;
};

const runSchema = z.object({
  nowMs: z.number().optional()
});

function formatReminderTime(eventStart: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit'
  })
    .format(new Date(eventStart))
    .toLowerCase();
}

export function formatScheduleReminderMessage(reminder: DueScheduleReminder, timeZone = 'Australia/Sydney') {
  const lines = [`Reminder: ${reminder.title} starts at ${formatReminderTime(reminder.eventStart, timeZone)}.`];

  if (reminder.location) {
    lines.push(`Location: ${reminder.location}`);
  }

  return lines.join('\n');
}

function aggregateStatus(results: Array<{ status: ScheduleReminderAttemptStatus; errorCode?: string }>) {
  const failed = results.find((result) => result.status === 'failed');
  if (failed) return failed;

  const skipped = results.find((result) => result.status === 'skipped');
  if (skipped) return skipped;

  return { status: 'sent' as const };
}

export function createScheduleReminderRoutes({
  serviceToken,
  recipientUserIds,
  leadTimeMinutes,
  timeZone = 'Australia/Sydney',
  store,
  sendNotification
}: CreateScheduleReminderRoutesOptions) {
  const routes = new Hono();

  routes.post('/run', async (c) => {
    if (!isAuthorizedServiceRequest(c.req.raw, serviceToken)) {
      return jsonError(c, 401, 'unauthorized');
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return jsonError(c, 400, 'bad_request');
    }

    const run = runSchema.safeParse(body);
    if (!run.success) {
      return jsonError(c, 400, 'invalid_reminder_run');
    }

    const nowMs = run.data.nowMs ?? Date.now();
    const candidates = await store.getDueReminderCandidates({
      nowMs,
      leadTimeMinutes
    });
    const counts = {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0
    };

    for (const candidate of candidates) {
      const message = formatScheduleReminderMessage(candidate, timeZone);
      const results = await Promise.all(
        recipientUserIds.map((recipientUserId) =>
          sendNotification({
            recipientUserId,
            topic: 'schedule.reminder',
            message,
            metadata: {
              reminderKey: candidate.reminderKey,
              googleEventId: candidate.googleEventId
            }
          })
        )
      );
      const result = aggregateStatus(results);

      await store.recordReminderAttempt({
        reminderKey: candidate.reminderKey,
        googleEventId: candidate.googleEventId,
        eventStart: candidate.eventStart,
        leadTimeMinutes: candidate.leadTimeMinutes,
        attemptedAt: nowMs,
        status: result.status,
        providerErrorCode: result.errorCode
      });

      counts.processed += 1;
      counts[result.status] += 1;
    }

    return jsonOk(c, counts);
  });

  return routes;
}
