import type { FunctionReference } from 'convex/server';

import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import type { ScheduleReminderAttemptRecorder } from './reminders';
import {
  createBotGatewayNotificationSender,
  parseBotGatewayOrigin,
  parsePositiveIntegerEnv,
  parseRecipientUserIds,
  runScheduleReminderCycle
} from './reminders';

type ReminderAttempt = Parameters<ScheduleReminderAttemptRecorder>[0];

type ReminderStoreRefs = {
  reminderRunInputs: FunctionReference<
    'query',
    'internal',
    { nowMs: number; leadTimeMinutes: number; lookbackMs: number }
  >;
  recordReminderAttempt: FunctionReference<'mutation', 'internal', ReminderAttempt>;
};

const reminderStore: ReminderStoreRefs = (
  internal as unknown as {
    schedule: {
      reminderStore: ReminderStoreRefs;
    };
  }
).schedule.reminderStore;

export const runDueScheduleReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const serviceToken = process.env.BOT_SERVICE_TOKEN;
    if (!serviceToken) throw new Error('BOT_SERVICE_TOKEN env var is required for schedule reminder delivery');

    const nowMs = Date.now();
    const leadTimeMinutes = parsePositiveIntegerEnv(process.env.SCHEDULE_REMINDER_LEAD_TIME_MINUTES, 30);
    const lookbackMs = parsePositiveIntegerEnv(process.env.SCHEDULE_REMINDER_LOOKBACK_MINUTES, 30) * 60_000;
    const { events, attempts } = await ctx.runQuery(reminderStore.reminderRunInputs, {
      nowMs,
      leadTimeMinutes,
      lookbackMs
    });

    return runScheduleReminderCycle({
      events,
      attempts,
      nowMs,
      leadTimeMinutes,
      lookbackMs,
      timeZone: process.env.SCHEDULE_REMINDER_TZ ?? 'Australia/Sydney',
      recipientUserIds: parseRecipientUserIds(process.env.SCHEDULE_REMINDER_RECIPIENT_USER_IDS),
      sendNotification: createBotGatewayNotificationSender({
        botGatewayOrigin: parseBotGatewayOrigin(),
        serviceToken
      }),
      recordReminderAttempt: (attempt) => ctx.runMutation(reminderStore.recordReminderAttempt, attempt)
    });
  }
});
