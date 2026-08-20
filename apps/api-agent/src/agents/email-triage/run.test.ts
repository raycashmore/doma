import { GatewayForbiddenError } from '@ai-sdk/gateway';
import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';

import { runEmailTriageAgent } from './run.js';
import type { EmailTriageRunInput } from './schemas.js';

const usage = {
  inputTokens: { total: 12, noCache: 12, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 8, text: 8, reasoning: undefined }
};

const input = {
  capturedEmailId: 'capturedEmails_123',
  subject: 'Private subject',
  fromEmail: 'private-sender@example.com',
  receivedAt: Date.parse('2026-07-21T08:00:00.000Z'),
  textBody: 'Private household email body.',
  hasAttachments: false,
  attachmentMetadata: [],
  activeNoticeCandidates: [
    {
      id: 'email_old',
      category: 'school',
      title: 'Private candidate title',
      body: 'Private candidate body.',
      extractedFacts: [{ label: 'Private candidate fact', value: 'Private candidate value' }],
      obligation: null,
      createdAt: 1
    }
  ]
} satisfies EmailTriageRunInput;

function modelReturning(output: unknown) {
  return new MockLanguageModelV3({
    modelId: 'test/email-triage',
    doGenerate: async () => ({
      content: [{ type: 'text', text: JSON.stringify(output) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: []
    })
  });
}

describe('runEmailTriageAgent', () => {
  it('returns a typed Home notice and stores a privacy-safe trace', async () => {
    const saveTrace = vi.fn();
    const result = await runEmailTriageAgent({
      model: modelReturning({
        outcome: 'notice',
        category: 'school',
        priority: 'high',
        title: 'Return permission form',
        body: 'The form is due next week.',
        extractedFacts: [{ label: 'Due', value: '2026-07-31' }],
        reason: '',
        obligation: {
          action: 'Return the permission form',
          dueOn: '2026-07-31',
          dueDateConfidence: 'high',
          dueDateEvidence: 'due Friday 31 July'
        },
        relevance: {
          relevantThrough: '2026-08-02',
          dateConfidence: 'high',
          dateEvidence: 'Private relevance evidence'
        },
        supersession: {
          noticeId: 'email_old',
          confidence: 'high',
          evidence: 'Private supersession evidence'
        }
      }),
      input,
      saveTrace,
      createRunId: () => 'email_run_123',
      now: () => 1_700_000_000_000
    });

    expect(result).toEqual({
      runId: 'email_run_123',
      status: 'completed',
      outcome: expect.objectContaining({ kind: 'notice', title: 'Return permission form' })
    });
    expect(saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'email_run_123',
        capturedEmailId: 'capturedEmails_123',
        model: 'test/email-triage',
        outcomeKind: 'notice',
        hasObligation: true,
        validation: { status: 'valid' },
        tokenUsage: { input: 12, output: 8 },
        expiresAt: 1_702_592_000_000
      })
    );
    const serializedTrace = JSON.stringify(saveTrace.mock.calls);
    expect(serializedTrace).not.toContain('Private subject');
    expect(serializedTrace).not.toContain('private-sender@example.com');
    expect(serializedTrace).not.toContain('Private household email body.');
    expect(serializedTrace).not.toContain('Return permission form');
    expect(serializedTrace).not.toContain('Private candidate title');
    expect(serializedTrace).not.toContain('Private candidate body.');
    expect(serializedTrace).not.toContain('Private candidate fact');
    expect(serializedTrace).not.toContain('Private relevance evidence');
    expect(serializedTrace).not.toContain('Private supersession evidence');
  });

  it('fails closed when model lifecycle metadata is malformed', async () => {
    const saveTrace = vi.fn();
    const result = await runEmailTriageAgent({
      model: modelReturning({
        outcome: 'notice',
        category: 'admin',
        priority: 'medium',
        title: 'Updated event details',
        body: 'The event details have changed.',
        extractedFacts: [{ label: 'Status', value: 'Updated' }],
        reason: '',
        obligation: null,
        relevance: 'Private malformed relevance metadata',
        supersession: {
          noticeId: 123,
          confidence: false,
          evidence: ['Private malformed supersession evidence']
        }
      }),
      input,
      saveTrace,
      logError: vi.fn(),
      createRunId: () => 'email_run_malformed_lifecycle',
      now: () => 1_700_000_000_000
    });

    expect(result).toEqual({
      runId: 'email_run_malformed_lifecycle',
      status: 'failed',
      reason: 'invalid_ai_output'
    });
    expect(saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        outcomeKind: 'failed',
        validation: { status: 'invalid', reason: 'invalid_ai_output' }
      })
    );
    expect(JSON.stringify(saveTrace.mock.calls)).not.toContain('Private malformed');
  });

  it('fails closed when the structured result contains an impossible due date', async () => {
    const saveTrace = vi.fn();
    const result = await runEmailTriageAgent({
      model: modelReturning({
        outcome: 'notice',
        category: 'admin',
        priority: 'high',
        title: 'Submit form',
        body: 'The form needs attention.',
        extractedFacts: [],
        reason: '',
        obligation: {
          action: 'Submit the form',
          dueOn: '2026-02-30',
          dueDateConfidence: 'high',
          dueDateEvidence: '30 February'
        },
        relevance: { relevantThrough: '', dateConfidence: 'low', dateEvidence: '' },
        supersession: { noticeId: '', confidence: 'low', evidence: '' }
      }),
      input,
      saveTrace,
      logError: vi.fn(),
      createRunId: () => 'email_run_invalid'
    });

    expect(result).toEqual({ runId: 'email_run_invalid', status: 'failed', reason: 'invalid_ai_output' });
    expect(saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({ validation: { status: 'invalid', reason: 'invalid_ai_output' } })
    );
  });

  it('records safe gateway diagnostics without retaining the private request', async () => {
    const model = new MockLanguageModelV3({
      modelId: 'openai/gpt-5.4-mini',
      doGenerate: async () => {
        throw new GatewayForbiddenError({
          message: 'Provider echoed Private household email body.',
          statusCode: 403,
          generationId: 'generation_email_123'
        });
      }
    });
    const saveTrace = vi.fn();
    const logError = vi.fn();

    const result = await runEmailTriageAgent({
      model,
      input,
      saveTrace,
      logError,
      createRunId: () => 'email_run_failed'
    });

    expect(result).toEqual({ runId: 'email_run_failed', status: 'failed', reason: 'provider_failure' });
    expect(saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          name: 'GatewayForbiddenError',
          message: 'Provider echoed [redacted] [generation_email_123]',
          statusCode: 403,
          generationId: 'generation_email_123'
        })
      })
    );
    expect(JSON.stringify([saveTrace.mock.calls, logError.mock.calls])).not.toContain('Private household email body.');
  });

  it('redacts normalized multiline content and attachment metadata from gateway diagnostics', async () => {
    const multilineInput = {
      ...input,
      textBody: 'Private household\nemail body.',
      attachmentMetadata: [{ filename: 'Private school letter.pdf', contentType: 'application/pdf' }]
    } satisfies EmailTriageRunInput;
    const model = new MockLanguageModelV3({
      modelId: 'openai/gpt-5.4-mini',
      doGenerate: async () => {
        throw new GatewayForbiddenError({
          message: 'Provider echoed Private household email body. and Private school letter.pdf.',
          statusCode: 403
        });
      }
    });
    const saveTrace = vi.fn();
    const logError = vi.fn();

    await runEmailTriageAgent({
      model,
      input: multilineInput,
      saveTrace,
      logError,
      createRunId: () => 'email_run_multiline'
    });

    const diagnostics = JSON.stringify([saveTrace.mock.calls, logError.mock.calls]);
    expect(diagnostics).not.toContain('Private household email body.');
    expect(diagnostics).not.toContain('Private school letter.pdf');
  });
});
