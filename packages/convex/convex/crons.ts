import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();
const reminderRunner = (internal as any).schedule.reminderRunner;

crons.interval('schedule reminder delivery', { minutes: 30 }, reminderRunner.runDueScheduleReminders);

export default crons;
