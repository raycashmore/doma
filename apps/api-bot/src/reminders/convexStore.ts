import type { DueScheduleReminder, ScheduleReminderStore } from './schedule.js';

type ConvexResponse = { status: 'success'; value: unknown } | { status: 'error'; errorMessage: string };

async function runConvexFunction<T>({
  convexUrl,
  kind,
  path,
  args
}: {
  convexUrl: string;
  kind: 'query' | 'mutation';
  path: string;
  args: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(`${convexUrl}/api/${kind}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Convex-Client': 'doma-api-bot'
    },
    body: JSON.stringify({
      path,
      format: 'convex_encoded_json',
      args: [args]
    })
  });

  if (!response.ok && response.status !== 560) {
    throw new Error(await response.text());
  }

  const result = (await response.json()) as ConvexResponse;

  if (result.status === 'error') {
    throw new Error(result.errorMessage);
  }

  return result.value as T;
}

export function createConvexScheduleReminderStore({
  convexUrl,
  serviceToken
}: {
  convexUrl: string;
  serviceToken: string;
}): ScheduleReminderStore {
  return {
    getDueReminderCandidates: ({ nowMs, leadTimeMinutes }) =>
      runConvexFunction<DueScheduleReminder[]>({
        convexUrl,
        kind: 'query',
        path: 'schedule/reminders:dueReminderCandidates',
        args: {
          serviceToken,
          nowMs,
          leadTimeMinutes
        }
      }),
    recordReminderAttempt: (attempt) =>
      runConvexFunction({
        convexUrl,
        kind: 'mutation',
        path: 'schedule/reminders:recordReminderAttempt',
        args: {
          serviceToken,
          ...attempt
        }
      })
  };
}
