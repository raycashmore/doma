import { describe, expect, it, vi } from 'vitest';

const cronMocks = vi.hoisted(() => ({
  interval: vi.fn(),
  morningBriefingDelivery: Symbol('morningBriefingDelivery'),
  scheduleReminderDelivery: Symbol('scheduleReminderDelivery')
}));

vi.mock('convex/server', () => ({
  cronJobs: () => ({
    interval: cronMocks.interval
  })
}));

vi.mock('./_generated/api', () => ({
  internal: {
    briefing: {
      deliveryRunner: {
        runDueMorningBriefingDelivery: cronMocks.morningBriefingDelivery
      }
    },
    schedule: {
      reminderRunner: {
        runDueScheduleReminders: cronMocks.scheduleReminderDelivery
      }
    }
  }
}));

describe('Convex cron registration', () => {
  it('keeps morning briefing delivery as the only proactive schedule notification path', async () => {
    await import('./crons');

    expect(cronMocks.interval).toHaveBeenCalledOnce();
    expect(cronMocks.interval).toHaveBeenCalledWith(
      'morning briefing delivery',
      { minutes: 10 },
      cronMocks.morningBriefingDelivery
    );
  });
});
