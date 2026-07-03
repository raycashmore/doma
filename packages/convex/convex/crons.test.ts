import { describe, expect, it, vi } from 'vitest';

const cronMocks = vi.hoisted(() => ({
  interval: vi.fn(),
  morningBriefingDelivery: Symbol('morningBriefingDelivery'),
  emailTriage: Symbol('emailTriage'),
  emailNoticeDelivery: Symbol('emailNoticeDelivery'),
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
    email: {
      triage: {
        runDueForwardedEmailTriage: cronMocks.emailTriage
      },
      deliveryRunner: {
        runDueEmailNoticeDelivery: cronMocks.emailNoticeDelivery
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
  it('registers proactive notification delivery without restoring event-level schedule reminders', async () => {
    await import('./crons');

    expect(cronMocks.interval).toHaveBeenCalledTimes(3);
    expect(cronMocks.interval).toHaveBeenCalledWith(
      'morning briefing delivery',
      { minutes: 10 },
      cronMocks.morningBriefingDelivery
    );
    expect(cronMocks.interval).toHaveBeenCalledWith('forwarded email triage', { minutes: 10 }, cronMocks.emailTriage);
    expect(cronMocks.interval).toHaveBeenCalledWith(
      'forwarded email notice delivery',
      { minutes: 10 },
      cronMocks.emailNoticeDelivery
    );
  });
});
