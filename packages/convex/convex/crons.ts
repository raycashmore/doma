import { cronJobs, type FunctionReference } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

type ReminderRunnerRefs = {
  runDueScheduleReminders: FunctionReference<'action', 'internal', Record<string, never>, unknown>;
};

type BriefingDeliveryRunnerRefs = {
  runDueMorningBriefingDelivery: FunctionReference<'action', 'internal', Record<string, never>, unknown>;
};

const reminderRunner: ReminderRunnerRefs = (
  internal as unknown as {
    schedule: {
      reminderRunner: ReminderRunnerRefs;
    };
  }
).schedule.reminderRunner;

const briefingDeliveryRunner: BriefingDeliveryRunnerRefs = (
  internal as unknown as {
    briefing: {
      deliveryRunner: BriefingDeliveryRunnerRefs;
    };
  }
).briefing.deliveryRunner;

crons.interval('schedule reminder delivery', { minutes: 30 }, reminderRunner.runDueScheduleReminders);
crons.interval('morning briefing delivery', { minutes: 10 }, briefingDeliveryRunner.runDueMorningBriefingDelivery);

export default crons;
