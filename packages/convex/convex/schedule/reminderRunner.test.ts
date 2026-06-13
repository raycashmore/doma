import { describe, expect, it, vi } from 'vitest';

const runnerMocks = vi.hoisted(() => ({
  internalAction: vi.fn((definition) => definition)
}));

vi.mock('../_generated/server', () => ({
  internalAction: runnerMocks.internalAction,
  mutation: vi.fn((definition) => definition),
  query: vi.fn((definition) => definition)
}));

vi.mock('../_generated/api', () => ({
  internal: {
    schedule: {
      reminderStore: {
        reminderRunInputs: Symbol('reminderRunInputs'),
        recordReminderAttempt: Symbol('recordReminderAttempt')
      }
    }
  }
}));

describe('runDueScheduleReminders', () => {
  it('is retired and does not read reminder candidates or send notifications', async () => {
    const { runDueScheduleReminders } = (await import('./reminderRunner')) as unknown as {
      runDueScheduleReminders: {
        handler: (ctx: { runQuery: ReturnType<typeof vi.fn>; runMutation: ReturnType<typeof vi.fn> }) => Promise<{
          processed: number;
          sent: number;
          skipped: number;
          failed: number;
          retired: boolean;
        }>;
      };
    };
    const ctx = {
      runQuery: vi.fn(),
      runMutation: vi.fn()
    };

    await expect(runDueScheduleReminders.handler(ctx)).resolves.toEqual({
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      retired: true
    });

    expect(ctx.runQuery).not.toHaveBeenCalled();
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});
