import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import type { AgentConfig } from './config.js';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createConvex: vi.fn(),
  run: vi.fn()
}));

vi.mock('./auth/clerk.js', () => ({ authenticateClerkRequest: mocks.authenticate }));
vi.mock('./convex/weeklyMeals.js', () => ({ createWeeklyMealsConvex: mocks.createConvex }));
vi.mock('./agents/weekly-meals/run.js', () => ({ runWeeklyMealsAgent: mocks.run }));

const config: AgentConfig = {
  agentServiceToken: 'service-token',
  appOrigin: 'https://home.example.com',
  clerkPublishableKey: 'pk_test',
  clerkSecretKey: 'sk_test',
  convexUrl: 'https://example.convex.cloud',
  weeklyMealsModel: 'test/model'
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createConvex.mockReturnValue({ tools: {}, saveTrace: vi.fn() });
});

describe('weekly meals agent HTTP boundary', () => {
  it('rejects requests without a valid Clerk session', async () => {
    mocks.authenticate.mockResolvedValue(null);
    const response = await createApp(config).request('/weekly-meals', { method: 'POST', body: '{}' });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
  });

  it('validates input before creating a model run', async () => {
    mocks.authenticate.mockResolvedValue({ userId: 'user_123' });
    const response = await createApp(config).request('/weekly-meals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weekStart: 'not-a-date' })
    });
    expect(response.status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('binds Convex tools and the agent input to the authenticated user', async () => {
    mocks.authenticate.mockResolvedValue({ userId: 'user_123' });
    mocks.run.mockResolvedValue({
      runId: 'run_123',
      outcome: { kind: 'cannotPropose', reason: 'No suitable recipes.' }
    });
    const response = await createApp(config).request('/weekly-meals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weekStart: '2026-07-20', expectedPlanUpdatedAt: null })
    });

    expect(response.status).toBe(200);
    expect(mocks.createConvex).toHaveBeenCalledWith(config, '2026-07-20', 'user_123');
    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({ input: { userId: 'user_123', weekStart: '2026-07-20', expectedPlanUpdatedAt: null } })
    );
  });

  it('returns a privacy-safe error when the provider fails', async () => {
    mocks.authenticate.mockResolvedValue({ userId: 'user_123' });
    mocks.run.mockRejectedValue(new Error('provider secret detail'));
    const response = await createApp(config).request('/weekly-meals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weekStart: '2026-07-20', expectedPlanUpdatedAt: null })
    });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'internal_server_error' });
  });
});
