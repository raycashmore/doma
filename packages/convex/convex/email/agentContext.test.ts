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
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue(email),
        query: () => ({ collect: async () => [] })
      }
    };

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
      attachmentMetadata: [],
      activeNoticeCandidates: []
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

  it('adds only visible, bounded notice candidates after the email is claimed', async () => {
    vi.stubEnv('AGENT_SERVICE_TOKEN', 'expected');
    const notices = [
      ...Array.from({ length: 21 }, (_, index) => ({
        _id: `email_${index}`,
        capturedEmailId: `capturedEmails_${index}`,
        category: 'admin' as const,
        title: `Notice ${index}`,
        body: `Body ${index}`,
        rawBody: 'private prior raw body',
        extractedFacts: [{ label: 'Fact', value: `Value ${index}` }],
        obligation: null,
        createdAt: index
      })),
      {
        _id: 'email_expired',
        category: 'school' as const,
        title: 'Expired',
        body: 'Expired body',
        extractedFacts: [],
        obligation: null,
        createdAt: 22,
        expiresAt: 100
      },
      {
        _id: 'email_superseded',
        category: 'school' as const,
        title: 'Superseded',
        body: 'Superseded body',
        extractedFacts: [],
        obligation: null,
        createdAt: 23,
        supersededAt: 99
      }
    ];
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({
          _id: 'capturedEmails_123',
          subject: 'Permission form',
          fromEmail: 'forwarder@example.com',
          receivedAt: 10,
          textBody: 'The form is due Friday.',
          hasAttachments: false,
          attachmentMetadata: [],
          processingState: 'processing'
        }),
        query: (table: 'emailNotices' | 'boardArchives') => ({
          collect: async () =>
            table === 'emailNotices'
              ? notices
              : [
                  {
                    occurrenceId: 'emailNotice:email_19',
                    sourceKind: 'forwardedEmail',
                    archivedByUserId: 'user_123',
                    archivedAt: 99
                  }
                ]
        })
      }
    };

    const input = await readClaimedEmailInput(
      ctx as never,
      { serviceToken: 'expected', capturedEmailId: 'capturedEmails_123' },
      { nowMs: 100 }
    );

    expect(input?.activeNoticeCandidates).toHaveLength(20);
    expect(input?.activeNoticeCandidates.map((candidate) => candidate.id)).toEqual([
      'email_20',
      'email_18',
      'email_17',
      'email_16',
      'email_15',
      'email_14',
      'email_13',
      'email_12',
      'email_11',
      'email_10',
      'email_9',
      'email_8',
      'email_7',
      'email_6',
      'email_5',
      'email_4',
      'email_3',
      'email_2',
      'email_1',
      'email_0'
    ]);
    expect(JSON.stringify(input?.activeNoticeCandidates)).not.toContain('private prior raw body');
    expect(JSON.stringify(input?.activeNoticeCandidates)).not.toContain('email_expired');
    expect(JSON.stringify(input?.activeNoticeCandidates)).not.toContain('email_superseded');
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
