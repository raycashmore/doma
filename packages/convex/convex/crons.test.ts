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
  mealAgentCleanup: Symbol('mealAgentCleanup'),
  emailAgentCleanup: Symbol('emailAgentCleanup')
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
        runDueEmailReminderDelivery: cronMocks.emailNoticeDelivery
      },
      agentCleanup: { deleteExpiredRuns: cronMocks.emailAgentCleanup }
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

    expect(cronMocks.interval).toHaveBeenCalledTimes(6);
    expect(cronMocks.daily).toHaveBeenCalledTimes(1);
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
    expect(cronMocks.interval).toHaveBeenCalledWith('forwarded email triage', { minutes: 15 }, cronMocks.emailTriage);
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
    expect(cronMocks.interval).toHaveBeenCalledWith(
      'email triage agent trace cleanup',
      { hours: 1 },
      cronMocks.emailAgentCleanup
    );
    expect(cronMocks.interval).toHaveBeenCalledWith(
      'forwarded email reminder delivery',
      { minutes: 15 },
      cronMocks.emailNoticeDelivery
    );
  });
});
