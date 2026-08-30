import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import type { AgentConfig } from './config.js';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createConvex: vi.fn(),
  run: vi.fn(),
  createEmailConvex: vi.fn(),
  runEmail: vi.fn()
}));

vi.mock('./auth/clerk.js', () => ({ authenticateClerkRequest: mocks.authenticate }));
vi.mock('./convex/weeklyMeals.js', () => ({ createWeeklyMealsConvex: mocks.createConvex }));
vi.mock('./agents/weekly-meals/run.js', () => ({ runWeeklyMealsAgent: mocks.run }));
vi.mock('./convex/emailTriage.js', () => ({ createEmailTriageConvex: mocks.createEmailConvex }));
vi.mock('./agents/email-triage/run.js', () => ({ runEmailTriageAgent: mocks.runEmail }));

const config: AgentConfig = {
  agentServiceToken: 'service-token',
  appOrigin: 'https://home.example.com',
  clerkPublishableKey: 'pk_test',
  clerkSecretKey: 'sk_test',
  convexUrl: 'https://example.convex.cloud',
  emailTriageModel: 'test/email-triage',
  weeklyMealsModel: 'test/model'
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createConvex.mockReturnValue({ tools: {}, saveTrace: vi.fn() });
  mocks.createEmailConvex.mockReturnValue({
    loadInput: vi.fn().mockResolvedValue({
      capturedEmailId: 'capturedEmails_123',
      subject: 'Generic subject',
      fromEmail: 'sender@example.com',
      receivedAt: 1_700_000_000_000,
      textBody: 'A generic household message.',
      hasAttachments: false,
      attachmentMetadata: []
    }),
    saveTrace: vi.fn()
  });
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

describe('email triage agent HTTP boundary', () => {
  it('requires the internal service bearer token', async () => {
    const response = await createApp(config).request('/internal/email-triage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capturedEmailId: 'capturedEmails_123' })
    });

    expect(response.status).toBe(401);
    expect(mocks.createEmailConvex).not.toHaveBeenCalled();
  });

  it('validates the captured email id before reading private source content', async () => {
    const response = await createApp(config).request('/internal/email-triage', {
      method: 'POST',
      headers: { authorization: 'Bearer service-token', 'content-type': 'application/json' },
      body: JSON.stringify({ capturedEmailId: '' })
    });

    expect(response.status).toBe(400);
    expect(mocks.createEmailConvex).not.toHaveBeenCalled();
  });

  it('loads the claimed email through Convex and returns the stable runner result', async () => {
    mocks.runEmail.mockResolvedValue({
      runId: 'email_run_123',
      status: 'completed',
      outcome: { kind: 'noNotice', reason: 'No household action.' }
    });
    const response = await createApp(config).request('/internal/email-triage', {
      method: 'POST',
      headers: { authorization: 'Bearer service-token', 'content-type': 'application/json' },
      body: JSON.stringify({ capturedEmailId: 'capturedEmails_123' })
    });

    expect(response.status).toBe(200);
    const boundary = mocks.createEmailConvex.mock.results[0]?.value;
    expect(mocks.createEmailConvex).toHaveBeenCalledWith(config, 'capturedEmails_123');
    expect(mocks.runEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test/email-triage',
        input: expect.objectContaining({ capturedEmailId: 'capturedEmails_123' }),
        saveTrace: boundary.saveTrace,
        onGenerationTrace: expect.any(Function)
      })
    );
    await expect(response.json()).resolves.toEqual({
      runId: 'email_run_123',
      status: 'completed',
      outcome: { kind: 'noNotice', reason: 'No household action.' }
    });
  });

  it('returns not found when the email is no longer claimed for processing', async () => {
    mocks.createEmailConvex.mockReturnValue({ loadInput: vi.fn().mockResolvedValue(null), saveTrace: vi.fn() });
    const response = await createApp(config).request('/internal/email-triage', {
      method: 'POST',
      headers: { authorization: 'Bearer service-token', 'content-type': 'application/json' },
      body: JSON.stringify({ capturedEmailId: 'capturedEmails_123' })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'captured_email_unavailable' });
    expect(mocks.runEmail).not.toHaveBeenCalled();
  });
});
