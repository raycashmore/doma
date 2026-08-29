import { afterEach, describe, expect, it, vi } from 'vitest';

import { emitMorningBriefingGenerationTrace, langfuseConfigFromEnv } from './langfuse';
import type { DeterministicMorningBriefing } from './morning';

const trace = {
  startedAt: 1_750_000_000_000,
  completedAt: 1_750_000_002_000,
  model: 'gpt-test',
  input: {
    localDate: '2026-06-12',
    timeZone: 'Australia/Sydney',
    sources: [
      {
        sourceId: 'requirements-calendar:event-1:1750000000000',
        calendarId: 'requirements-calendar',
        kind: 'dailyRequirements' as const,
        title: 'Sensitive requirement detail',
        start: 1_750_000_000_000,
        end: 1_750_003_600_000,
        localStart: '2026-06-12T08:00:00',
        localEnd: '2026-06-12T09:00:00',
        localTimeBlock: 'morning' as const,
        allDay: false,
        who: ['memberA'],
        recurring: false
      }
    ]
  },
  output: {
    briefingKind: 'morning',
    localDate: '2026-06-12',
    generationStatus: 'ai',
    briefing: {
      shouldSend: true,
      headline: 'Specific day',
      morning: [
        {
          text: 'Sensitive rendered briefing detail',
          who: ['memberA'],
          sourceIds: ['requirements-calendar:event-1:1750000000000']
        }
      ],
      afternoon: [],
      watchouts: [],
      sourceIdsIgnored: []
    },
    message: 'Sensitive rendered briefing detail',
    sourceIds: ['requirements-calendar:event-1:1750000000000']
  } satisfies DeterministicMorningBriefing
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

describe('emitMorningBriefingGenerationTrace', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports a nested OTLP trace without private briefing content by default', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await emitMorningBriefingGenerationTrace({
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
    expect(attributeValue(generationSpan, 'langfuse.observation.model.name')).toBe('gpt-test');
    expect(serializedRequest).not.toContain('Sensitive requirement detail');
    expect(serializedRequest).not.toContain('Sensitive rendered briefing detail');
  });

  it('includes the source and rendered output only when explicitly enabled', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await emitMorningBriefingGenerationTrace({
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

    expect(serializedRequest).toContain('Sensitive requirement detail');
    expect(serializedRequest).toContain('Sensitive rendered briefing detail');
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
      const exportPromise = emitMorningBriefingGenerationTrace({
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
        '[briefing.langfuse] Trace export failed',
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
