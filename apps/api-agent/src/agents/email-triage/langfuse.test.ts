import { afterEach, describe, expect, it, vi } from 'vitest';

import { emitEmailTriageGenerationTrace, langfuseConfigFromEnv } from './langfuse.js';

const trace = {
  runId: 'email_run_123',
  model: 'openai/gpt-test',
  promptVersion: 'email-triage-v2',
  startedAt: 1_750_000_000_000,
  completedAt: 1_750_000_002_000,
  input: {
    capturedEmailId: 'capturedEmails_123',
    subject: 'Sensitive email subject',
    fromEmail: 'sensitive-sender@example.com',
    receivedAt: 1_750_000_000_000,
    textBody: 'Sensitive forwarded email detail',
    hasAttachments: true,
    attachmentMetadata: [{ filename: 'sensitive.pdf' }],
    activeNoticeCandidates: [
      {
        id: 'emailNotices_123',
        category: 'school' as const,
        title: 'Sensitive prior notice',
        body: 'Sensitive prior notice detail',
        extractedFacts: [],
        obligation: null,
        createdAt: 1_749_000_000_000
      }
    ]
  },
  output: {
    kind: 'notice' as const,
    category: 'school' as const,
    priority: 'high' as const,
    title: 'Sensitive generated title',
    body: 'Sensitive generated summary',
    extractedFacts: [{ label: 'Sensitive fact', value: 'Sensitive value' }],
    obligation: {
      action: 'Sensitive action',
      dueOn: '2026-08-30',
      dueDateConfidence: 'high' as const,
      dueDateEvidence: 'Sensitive due-date evidence'
    },
    relevance: { relevantThrough: '2026-08-30', dateConfidence: 'high' as const, dateEvidence: 'Sensitive relevance' },
    supersession: { noticeId: null, confidence: 'low' as const, evidence: '' }
  },
  stopReason: 'stop',
  tokenUsage: { input: 100, output: 50 },
  validation: { status: 'valid' as const }
};

describe('langfuseConfigFromEnv', () => {
  it('is disabled until both Langfuse credentials are configured', () => {
    expect(langfuseConfigFromEnv({ LANGFUSE_PUBLIC_KEY: 'public' })).toBeNull();
  });

  it('defaults to metadata-only capture and the EU Cloud endpoint', () => {
    expect(
      langfuseConfigFromEnv({
        LANGFUSE_PUBLIC_KEY: 'public',
        LANGFUSE_SECRET_KEY: 'secret'
      })
    ).toMatchObject({
      baseUrl: 'https://cloud.langfuse.com',
      captureContent: false
    });
  });
});

describe('emitEmailTriageGenerationTrace', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports a nested OTLP trace without private email content by default', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await emitEmailTriageGenerationTrace({
      config: {
        baseUrl: 'https://langfuse.example',
        publicKey: 'public',
        secretKey: 'secret',
        environment: 'production',
        captureContent: false
      },
      trace,
      fetchImpl
    });

    const request = requestBody(fetchImpl);
    const spans = traceSpans(request);
    const serializedRequest = JSON.stringify(request);
    const [rootSpan, generationSpan] = spans;
    if (!rootSpan || !generationSpan) throw new Error('Expected root and generation spans');

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://langfuse.example/api/public/otel/v1/traces',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: `Basic ${btoa('public:secret')}`,
          'x-langfuse-ingestion-version': '4'
        })
      })
    );
    expect(spans).toHaveLength(2);
    expect(generationSpan.parentSpanId).toBe(rootSpan.spanId);
    expect(attributeValue(generationSpan, 'langfuse.observation.type')).toBe('generation');
    expect(attributeValue(generationSpan, 'langfuse.observation.model.name')).toBe('openai/gpt-test');
    expect(serializedRequest).not.toContain('Sensitive email subject');
    expect(serializedRequest).not.toContain('sensitive-sender@example.com');
    expect(serializedRequest).not.toContain('Sensitive forwarded email detail');
    expect(serializedRequest).not.toContain('Sensitive generated title');
    expect(serializedRequest).not.toContain('Sensitive generated summary');
    expect(serializedRequest).not.toContain('Sensitive action');
  });

  it('includes the complete input and output only when explicitly enabled', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await emitEmailTriageGenerationTrace({
      config: {
        baseUrl: 'https://langfuse.example',
        publicKey: 'public',
        secretKey: 'secret',
        captureContent: true
      },
      trace,
      fetchImpl
    });

    const serializedRequest = JSON.stringify(requestBody(fetchImpl));

    expect(serializedRequest).toContain('Sensitive forwarded email detail');
    expect(serializedRequest).toContain('Sensitive generated title');
  });

  it('stops waiting when the Langfuse request exceeds the export timeout', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const exportPromise = emitEmailTriageGenerationTrace({
        config: {
          baseUrl: 'https://langfuse.example',
          publicKey: 'public',
          secretKey: 'secret',
          captureContent: false
        },
        trace,
        fetchImpl
      });

      await vi.advanceTimersByTimeAsync(1_500);

      await expect(exportPromise).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        '[email-triage.langfuse] Trace export failed',
        expect.objectContaining({ error: 'AbortError' })
      );
    } finally {
      warn.mockRestore();
    }
  });
});

function requestBody(fetchImpl: ReturnType<typeof vi.fn>) {
  const request = fetchImpl.mock.calls[0]?.[1] as RequestInit;
  return JSON.parse(request.body as string) as {
    resourceSpans: Array<{
      scopeSpans: Array<{ spans: Array<{ spanId: string; parentSpanId?: string; attributes: unknown[] }> }>;
    }>;
  };
}

function attributeValue(span: { attributes: unknown[] }, key: string) {
  const attribute = span.attributes.find(
    (value): value is { key: string; value: { stringValue: string } } =>
      typeof value === 'object' &&
      value !== null &&
      'key' in value &&
      value.key === key &&
      'value' in value &&
      typeof value.value === 'object' &&
      value.value !== null &&
      'stringValue' in value.value &&
      typeof value.value.stringValue === 'string'
  );
  return attribute?.value.stringValue;
}

function traceSpans(request: ReturnType<typeof requestBody>) {
  const [resourceSpan] = request.resourceSpans;
  if (!resourceSpan) throw new Error('Expected a resource span');
  const [scopeSpan] = resourceSpan.scopeSpans;
  if (!scopeSpan) throw new Error('Expected a scope span');
  return scopeSpan.spans;
}
