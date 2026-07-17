import { describe, expect, it, vi } from 'vitest';

const cronMocks = vi.hoisted(() => ({
  daily: vi.fn(),
  interval: vi.fn(),
  morningBriefingDelivery: Symbol('morningBriefingDelivery'),
  emailTriage: Symbol('emailTriage'),
  emailNoticeDelivery: Symbol('emailNoticeDelivery'),
  scheduleReminderDelivery: Symbol('scheduleReminderDelivery'),
  spendingInsightSweep: Symbol('spendingInsightSweep'),
  spendingInsightDelivery: Symbol('spendingInsightDelivery'),
  mealAgentCleanup: Symbol('mealAgentCleanup')
}));

vi.mock('convex/server', () => ({
  cronJobs: () => ({
    daily: cronMocks.daily,
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
    },
    insights: {
      generation: {
        runDueSpendingInsightSweep: cronMocks.spendingInsightSweep
      },
      deliveryRunner: {
        runDueSpendingInsightDelivery: cronMocks.spendingInsightDelivery
      }
    },
    meals: { agentCleanup: { deleteExpiredRuns: cronMocks.mealAgentCleanup } }
  }
}));

describe('Convex cron registration', () => {
  it('registers proactive notification delivery without restoring event-level schedule reminders', async () => {
    await import('./crons');

    expect(cronMocks.interval).toHaveBeenCalledTimes(4);
    expect(cronMocks.daily).toHaveBeenCalledTimes(5);
    expect(cronMocks.interval).toHaveBeenCalledWith(
      'morning briefing delivery',
      { minutes: 10 },
      cronMocks.morningBriefingDelivery
    );
    expect(cronMocks.daily).toHaveBeenCalledWith(
      'weekly meal agent trace cleanup',
      { hourUTC: 15, minuteUTC: 0 },
      cronMocks.mealAgentCleanup
    );
    expect(cronMocks.interval).toHaveBeenCalledWith('forwarded email triage', { hours: 12 }, cronMocks.emailTriage);
    expect(cronMocks.interval).toHaveBeenCalledWith(
      'monthly spending insight sweep',
      { hours: 12 },
      cronMocks.spendingInsightSweep
    );
    expect(cronMocks.interval).toHaveBeenCalledWith(
      'monthly spending insight delivery',
      { hours: 1 },
      cronMocks.spendingInsightDelivery
    );
    expect(cronMocks.daily).toHaveBeenCalledWith(
      'forwarded email notice delivery morning',
      { hourUTC: 21, minuteUTC: 0 },
      cronMocks.emailNoticeDelivery
    );
    expect(cronMocks.daily).toHaveBeenCalledWith(
      'forwarded email notice delivery midday',
      { hourUTC: 1, minuteUTC: 0 },
      cronMocks.emailNoticeDelivery
    );
    expect(cronMocks.daily).toHaveBeenCalledWith(
      'forwarded email notice delivery afternoon',
      { hourUTC: 5, minuteUTC: 0 },
      cronMocks.emailNoticeDelivery
    );
    expect(cronMocks.daily).toHaveBeenCalledWith(
      'forwarded email notice delivery evening',
      { hourUTC: 9, minuteUTC: 0 },
      cronMocks.emailNoticeDelivery
    );
  });
});
