import { cronJobs, type FunctionReference } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

type ReminderRunnerRefs = {
  runDueScheduleReminders: FunctionReference<'action', 'internal', Record<string, never>, unknown>;
};

const reminderRunner: ReminderRunnerRefs = (
  internal as unknown as {
    schedule: {
      reminderRunner: ReminderRunnerRefs;
    };
  }
).schedule.reminderRunner;

crons.interval('schedule reminder delivery', { minutes: 30 }, reminderRunner.runDueScheduleReminders);

export default crons;
