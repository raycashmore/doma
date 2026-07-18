import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WeeklyMealsRunTrace } from '../agents/weekly-meals/trace.js';
import type { AgentConfig } from '../config.js';
import { createWeeklyMealsConvex } from './weeklyMeals.js';

const mocks = vi.hoisted(() => ({ mutation: vi.fn(), query: vi.fn() }));

vi.mock('convex/browser', () => ({
  ConvexHttpClient: class {
    mutation = mocks.mutation;
    query = mocks.query;
  }
}));

const config = {
  agentServiceToken: 'service_token',
  appOrigin: 'https://www.example.com',
  clerkPublishableKey: 'clerk_publishable',
  clerkSecretKey: 'clerk_secret',
  convexUrl: 'https://example.convex.cloud',
  weeklyMealsModel: 'openai/gpt-5.4-mini'
} satisfies AgentConfig;

describe('createWeeklyMealsConvex', () => {
  beforeEach(() => vi.clearAllMocks());

  it('persists gateway failure metadata with the agent run', async () => {
    const trace: WeeklyMealsRunTrace = {
      runId: 'run_failed',
      userId: 'user_123',
      weekStart: '2026-07-20',
      expectedPlanUpdatedAt: null,
      model: 'openai/gpt-5.4-mini',
      promptVersion: 'weekly-meals-v1',
      startedAt: 1,
      completedAt: 2,
      expiresAt: 3,
      stepCount: 0,
      stopReason: 'GatewayForbiddenError',
      error: {
        name: 'GatewayForbiddenError',
        message: 'AI Gateway credits are required.',
        statusCode: 403,
        type: 'forbidden',
        generationId: 'generation_123'
      },
      tokenUsage: { input: 0, output: 0 },
      toolCalls: [],
      inputSnapshot: {},
      outcome: { kind: 'cannotPropose', reason: 'No proposal available.' },
      validation: { status: 'invalid', reason: 'agent_failed' }
    };

    await createWeeklyMealsConvex(config, trace.weekStart, trace.userId).saveTrace(trace);

    expect(mocks.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorName: 'GatewayForbiddenError',
        errorMessage: 'AI Gateway credits are required.',
        errorStatusCode: 403,
        errorType: 'forbidden',
        errorGenerationId: 'generation_123'
      })
    );
  });
});
