import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteExpiredRunsHandler } from './agentCleanup';
import { readAgentPlanningContext, recordAgentRun } from './agentContext';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-18T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('weekly meal agent Convex boundary', () => {
  it('requires the dedicated service token before reading planning context', async () => {
    vi.stubEnv('AGENT_SERVICE_TOKEN', 'expected');
    await expect(
      readAgentPlanningContext({ db: {} } as never, {
        serviceToken: 'wrong',
        userId: 'user_123',
        weekStart: '2026-07-20'
      })
    ).rejects.toThrow('Unauthorized');
  });

  it('returns empty slots, versioned saved recipes, and target-week normalized busyness', async () => {
    vi.stubEnv('AGENT_SERVICE_TOKEN', 'expected');
    vi.stubEnv('SCHEDULE_TZ', 'UTC');
    const plan = {
      updatedAt: 42,
      assignments: [{ day: 'monday', meal: 'dinner', recipePublicId: 'recipe_existing' }]
    };
    const recipe = {
      publicId: 'recipe_saved',
      name: 'Saved noodles',
      description: 'A saved dinner.',
      preparationTime: '20 minutes',
      mealSuitabilityTags: ['Dinner', 'Quick'],
      updatedAt: 30
    };
    const mondayStart = Date.parse('2026-07-20T00:00:00.000Z');
    const ctx = {
      db: {
        query: (table: string) => ({
          withIndex: () => {
            if (table === 'weeklyMealPlans') return { unique: async () => plan };
            if (table === 'recipes') return { order: () => ({ collect: async () => [recipe] }) };
            return {
              collect: async () => [{ start: mondayStart, end: mondayStart + 7 * 3_600_000 }]
            };
          }
        })
      }
    };

    const result = await readAgentPlanningContext(ctx as never, {
      serviceToken: 'expected',
      userId: 'user_123',
      weekStart: '2026-07-20'
    });

    expect(result.openMealSlots.planUpdatedAt).toBe(42);
    expect(result.openMealSlots.slots).not.toContainEqual({ day: 'monday', meal: 'dinner' });
    expect(result.recipes).toEqual([recipe]);
    expect(result.busyness).toContainEqual({ day: 'monday', level: 'busy' });
  });

  it('rejects planning outside the cached current-and-next-week schedule horizon', async () => {
    vi.stubEnv('AGENT_SERVICE_TOKEN', 'expected');
    vi.stubEnv('SCHEDULE_TZ', 'UTC');

    await expect(
      readAgentPlanningContext({ db: {} } as never, {
        serviceToken: 'expected',
        userId: 'user_123',
        weekStart: '2026-08-03'
      })
    ).rejects.toThrow('outside the available schedule horizon');
  });

  it('records a trace without persisting its service credential', async () => {
    vi.stubEnv('AGENT_SERVICE_TOKEN', 'expected');
    const insert = vi.fn();
    const ctx = {
      db: {
        query: () => ({ withIndex: () => ({ unique: async () => null }) }),
        insert
      }
    };
    await recordAgentRun(ctx as never, {
      serviceToken: 'expected',
      runId: 'run_123',
      userId: 'user_123',
      weekStart: '2026-07-20',
      expectedPlanUpdatedAt: null,
      model: 'test/model',
      promptVersion: 'v1',
      startedAt: 1,
      completedAt: 2,
      expiresAt: 3,
      stepCount: 1,
      stopReason: 'stop',
      inputTokens: 1,
      outputTokens: 1,
      toolCallsJson: '[]',
      inputSnapshotJson: '{}',
      outcome: { kind: 'cannotPropose', reason: 'No suitable recipes.' },
      validationStatus: 'valid'
    });

    expect(insert).toHaveBeenCalledWith(
      'weeklyMealAgentRuns',
      expect.not.objectContaining({ serviceToken: expect.anything() })
    );
  });

  it('deletes expired traces in bounded batches', async () => {
    const remove = vi.fn();
    const take = vi.fn().mockResolvedValue([{ _id: 'run_row_1' }, { _id: 'run_row_2' }]);
    const ctx = {
      db: {
        query: () => ({ withIndex: () => ({ take }) }),
        delete: remove
      }
    };

    await expect(deleteExpiredRunsHandler(ctx as never, 1_000)).resolves.toBe(2);
    expect(take).toHaveBeenCalledWith(100);
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
