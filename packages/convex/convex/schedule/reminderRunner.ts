import { internalAction } from '../_generated/server';

export const runDueScheduleReminders = internalAction({
  args: {},
  handler: async () => {
    return {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      retired: true
    };
  }
});
