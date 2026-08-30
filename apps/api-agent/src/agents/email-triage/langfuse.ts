import type { EmailTriageOutcome, EmailTriageRunInput } from './schemas.js';
import type { EmailTriageAgentError } from './trace.js';

const exportTimeoutMs = 1_500;

export type LangfuseConfig = {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  environment?: string;
  captureContent: boolean;
};

export type EmailTriageGenerationTrace = {
  runId: string;
  model: string;
  promptVersion: string;
  startedAt: number;
  completedAt: number;
  input: EmailTriageRunInput;
  output: EmailTriageOutcome | null;
  stopReason: string;
  tokenUsage: { input: number; output: number };
  validation: { status: 'valid' } | { status: 'invalid'; reason: 'invalid_ai_output' | 'provider_failure' };
  error?: EmailTriageAgentError;
};

type OtelAttribute = {
  key: string;
  value: { stringValue: string } | { boolValue: boolean };
};

type OtelSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtelAttribute[];
};

export function langfuseConfigFromEnv(env: Record<string, string | undefined> = process.env): LangfuseConfig | null {
  const publicKey = env.LANGFUSE_PUBLIC_KEY;
  const secretKey = env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) return null;

  return {
    publicKey,
    secretKey,
    baseUrl: (env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com').replace(/\/$/, ''),
    ...(env.LANGFUSE_ENVIRONMENT ? { environment: env.LANGFUSE_ENVIRONMENT } : {}),
    captureContent: env.LANGFUSE_TRACE_CONTENT === 'true'
  };
}

export async function emitEmailTriageGenerationTrace({
  config,
  trace,
  fetchImpl = fetch
}: {
  config: LangfuseConfig | null;
  trace: EmailTriageGenerationTrace;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  if (!config) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), exportTimeoutMs);
    const traceId = randomId(16);
    const rootSpanId = randomId(8);
    const generationSpanId = randomId(8);
    const sharedAttributes = traceAttributes({ config, trace });
    const input = config.captureContent ? trace.input : inputSummary(trace.input);
    const output = config.captureContent ? trace.output : outputSummary(trace);

    const root = span({
      traceId,
      spanId: rootSpanId,
      name: 'email-triage.generation',
      startedAt: trace.startedAt,
      completedAt: trace.completedAt,
      attributes: [
        ...sharedAttributes,
        jsonAttribute('langfuse.observation.input', input),
        jsonAttribute('langfuse.observation.output', output)
      ]
    });
    const generation = span({
      traceId,
      spanId: generationSpanId,
      parentSpanId: rootSpanId,
      name: 'email-triage.llm',
      startedAt: trace.startedAt,
      completedAt: trace.completedAt,
      attributes: [
        ...sharedAttributes,
        stringAttribute('langfuse.observation.type', 'generation'),
        stringAttribute('langfuse.observation.model.name', trace.model),
        jsonAttribute('langfuse.observation.input', input),
        jsonAttribute('langfuse.observation.output', output)
      ]
    });

    try {
      const response = await fetchImpl(`${config.baseUrl}/api/public/otel/v1/traces`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${btoa(`${config.publicKey}:${config.secretKey}`)}`,
          'content-type': 'application/json',
          'x-langfuse-ingestion-version': '4'
        },
        signal: controller.signal,
        body: JSON.stringify({
          resourceSpans: [
            {
              resource: { attributes: [stringAttribute('service.name', 'doma-api-agent')] },
              scopeSpans: [{ scope: { name: 'doma.email-triage' }, spans: [root, generation] }]
            }
          ]
        })
      });

      if (!response.ok) {
        console.warn('[email-triage.langfuse] Trace export was rejected', { status: response.status });
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn('[email-triage.langfuse] Trace export failed', {
      error: error instanceof Error ? error.name : 'unknown_error'
    });
  }
}

function traceAttributes({ config, trace }: { config: LangfuseConfig; trace: EmailTriageGenerationTrace }) {
  return [
    stringAttribute('langfuse.trace.name', 'email-triage.generation'),
    stringAttribute('langfuse.trace.metadata.prompt_version', trace.promptVersion),
    stringAttribute('langfuse.trace.metadata.outcome_kind', trace.output?.kind ?? 'failed'),
    stringAttribute('langfuse.trace.metadata.validation_status', trace.validation.status),
    boolAttribute(
      'langfuse.trace.metadata.has_obligation',
      trace.output?.kind === 'notice' && trace.output.obligation !== null
    ),
    ...(config.environment ? [stringAttribute('langfuse.environment', config.environment)] : [])
  ];
}

function inputSummary(input: EmailTriageRunInput) {
  return {
    textBodyLength: input.textBody.length,
    hasAttachments: input.hasAttachments,
    attachmentCount: input.attachmentMetadata.length,
    activeNoticeCandidateCount: input.activeNoticeCandidates.length
  };
}

function outputSummary(trace: EmailTriageGenerationTrace) {
  if (!trace.output) {
    return {
      outcome: 'failed',
      validation: trace.validation,
      stopReason: trace.stopReason,
      ...(trace.error
        ? {
            error: {
              name: trace.error.name,
              ...(trace.error.statusCode === undefined ? {} : { statusCode: trace.error.statusCode }),
              ...(trace.error.type ? { type: trace.error.type } : {}),
              ...(trace.error.generationId ? { generationId: trace.error.generationId } : {})
            }
          }
        : {})
    };
  }

  if (trace.output.kind === 'noNotice') return { outcome: 'noNotice' };

  return {
    outcome: 'notice',
    category: trace.output.category,
    priority: trace.output.priority,
    extractedFactCount: trace.output.extractedFacts.length,
    hasObligation: trace.output.obligation !== null,
    ...(trace.output.obligation ? { dueDateConfidence: trace.output.obligation.dueDateConfidence } : {}),
    relevanceDateConfidence: trace.output.relevance.dateConfidence,
    supersessionConfidence: trace.output.supersession.confidence
  };
}

function span({
  traceId,
  spanId,
  parentSpanId,
  name,
  startedAt,
  completedAt,
  attributes
}: {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startedAt: number;
  completedAt: number;
  attributes: OtelAttribute[];
}): OtelSpan {
  return {
    traceId,
    spanId,
    ...(parentSpanId ? { parentSpanId } : {}),
    name,
    startTimeUnixNano: unixNano(startedAt),
    endTimeUnixNano: unixNano(completedAt),
    attributes
  };
}

function randomId(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function unixNano(milliseconds: number) {
  return (BigInt(milliseconds) * 1_000_000n).toString();
}

function stringAttribute(key: string, value: string): OtelAttribute {
  return { key, value: { stringValue: value } };
}

function boolAttribute(key: string, value: boolean): OtelAttribute {
  return { key, value: { boolValue: value } };
}

function jsonAttribute(key: string, value: unknown): OtelAttribute {
  return stringAttribute(key, JSON.stringify(value));
}
