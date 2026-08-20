import { describe, expect, it, vi } from 'vitest';

import { parseEmailTriageAgentResult, requestEmailTriageAgent, runNextEmailTriage } from './triage';

const completedResult = {
  runId: 'email_run_123',
  status: 'completed' as const,
  outcome: { kind: 'noNotice' as const, reason: 'No durable action.' }
};

const completeNoticeResult = {
  runId: 'email_run_456',
  status: 'completed' as const,
  outcome: {
    kind: 'notice' as const,
    category: 'admin' as const,
    priority: 'high' as const,
    title: 'Submit form',
    body: 'Submit the form by the stated date.',
    extractedFacts: [],
    obligation: null,
    relevance: {
      relevantThrough: '2026-08-04',
      dateConfidence: 'medium' as const,
      dateEvidence: 'The notice applies through 4 August.'
    },
    supersession: {
      noticeId: 'emailNotices_123',
      confidence: 'high' as const,
      evidence: 'This replaces the earlier form notice.'
    }
  }
};

describe('email triage agent bridge', () => {
  it('calls the service agent with only the claimed captured-email id', async () => {
    const fetchImpl = vi.fn(async () => Response.json(completedResult));
    await expect(
      requestEmailTriageAgent({
        capturedEmailId: 'capturedEmails_123',
        origin: 'https://agent.example.com',
        serviceToken: 'secret',
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).resolves.toEqual(completedResult);
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL('https://agent.example.com/internal/email-triage'),
      expect.objectContaining({
        method: 'POST',
        headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
        body: JSON.stringify({ capturedEmailId: 'capturedEmails_123' })
      })
    );
  });

  it('rejects malformed service output before persistence', () => {
    expect(parseEmailTriageAgentResult({ runId: 'x', status: 'completed', outcome: { kind: 'notice' } })).toBeNull();
  });

  it('preserves valid lifecycle metadata on a complete notice', () => {
    expect(parseEmailTriageAgentResult(completeNoticeResult)).toEqual(completeNoticeResult);
  });

  it('rejects a complete notice with malformed lifecycle metadata', () => {
    expect(
      parseEmailTriageAgentResult({
        ...completeNoticeResult,
        outcome: {
          ...completeNoticeResult.outcome,
          relevance: {
            relevantThrough: 'not-a-date',
            dateConfidence: 'high',
            dateEvidence: 'An invalid date should not persist.'
          },
          supersession: {
            noticeId: 123,
            confidence: 'medium',
            evidence: 'An invalid target should not persist.'
          }
        }
      })
    ).toBeNull();
  });

  it('claims, delegates, then passes the typed result to the persistence mutation', async () => {
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ _id: 'capturedEmails_123', processingState: 'processing' })
      .mockResolvedValueOnce({ status: 'noNotice' });
    const fetchImpl = vi.fn(async () => Response.json(completedResult));
    await expect(
      runNextEmailTriage({ runMutation } as never, {
        processedAt: 100,
        agentOrigin: 'https://agent.example.com',
        agentServiceToken: 'secret',
        fetchImpl: fetchImpl as unknown as typeof fetch
      })
    ).resolves.toEqual({ status: 'noNotice' });
    expect(runMutation).toHaveBeenLastCalledWith(expect.anything(), {
      capturedEmailId: 'capturedEmails_123',
      processedAt: 100,
      result: completedResult
    });
  });
});
