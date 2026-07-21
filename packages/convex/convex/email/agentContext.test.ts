import { afterEach, describe, expect, it, vi } from 'vitest';

import { readClaimedEmailInput, recordEmailTriageAgentRun } from './agentContext';

afterEach(() => vi.unstubAllEnvs());

describe('email triage agent Convex boundary', () => {
  it('returns only a currently claimed email to the service agent', async () => {
    vi.stubEnv('AGENT_SERVICE_TOKEN', 'expected');
    const email = {
      _id: 'capturedEmails_123',
      subject: 'Permission form',
      fromEmail: 'forwarder@example.com',
      receivedAt: 10,
      textBody: 'The form is due Friday.',
      hasAttachments: false,
      attachmentMetadata: [],
      processingState: 'processing'
    };
    const ctx = { db: { get: vi.fn().mockResolvedValue(email) } };

    await expect(
      readClaimedEmailInput(ctx as never, {
        serviceToken: 'expected',
        capturedEmailId: 'capturedEmails_123'
      })
    ).resolves.toEqual({
      capturedEmailId: 'capturedEmails_123',
      subject: 'Permission form',
      fromEmail: 'forwarder@example.com',
      receivedAt: 10,
      textBody: 'The form is due Friday.',
      hasAttachments: false,
      attachmentMetadata: []
    });
  });

  it('does not expose unclaimed email content', async () => {
    vi.stubEnv('AGENT_SERVICE_TOKEN', 'expected');
    const ctx = { db: { get: vi.fn().mockResolvedValue({ processingState: 'pending' }) } };
    await expect(
      readClaimedEmailInput(ctx as never, {
        serviceToken: 'expected',
        capturedEmailId: 'capturedEmails_123'
      })
    ).resolves.toBeNull();
  });

  it('requires the dedicated service token and never persists it in traces', async () => {
    vi.stubEnv('AGENT_SERVICE_TOKEN', 'expected');
    const insert = vi.fn();
    const ctx = {
      db: {
        query: () => ({ withIndex: () => ({ unique: async () => null }) }),
        insert
      }
    };
    const args = {
      serviceToken: 'expected',
      runId: 'email_run_123',
      capturedEmailId: 'capturedEmails_123',
      model: 'test/model',
      promptVersion: 'email-triage-v1',
      startedAt: 1,
      completedAt: 2,
      expiresAt: 3,
      stopReason: 'stop',
      inputTokens: 4,
      outputTokens: 5,
      outcomeKind: 'notice' as const,
      hasObligation: true,
      validationStatus: 'valid' as const
    };

    await recordEmailTriageAgentRun(ctx as never, args);
    expect(insert).toHaveBeenCalledWith(
      'emailTriageAgentRuns',
      expect.not.objectContaining({ serviceToken: expect.anything() })
    );
    await expect(recordEmailTriageAgentRun(ctx as never, { ...args, serviceToken: 'wrong' })).rejects.toThrow(
      'Unauthorized'
    );
  });
});
