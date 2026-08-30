import type { MorningBriefingAiInput } from './ai';
import type { DeterministicMorningBriefing } from './morning';

const exportTimeoutMs = 1_500;

export type LangfuseConfig = {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  environment?: string;
};

type MorningBriefingGenerationTrace = {
  startedAt: number;
  completedAt: number;
  input: MorningBriefingAiInput;
  output: DeterministicMorningBriefing;
  model: string;
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
    ...(env.LANGFUSE_ENVIRONMENT ? { environment: env.LANGFUSE_ENVIRONMENT } : {})
  };
}

export async function emitMorningBriefingGenerationTrace({
  config,
  trace,
  fetchImpl = fetch
}: {
  config: LangfuseConfig | null;
  trace: MorningBriefingGenerationTrace;
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
    const rootInput = inputSummary(trace.input);
    const rootOutput = outputSummary(trace.output);

    const root = span({
      traceId,
      spanId: rootSpanId,
      name: 'morning-briefing.generation',
      startedAt: trace.startedAt,
      completedAt: trace.completedAt,
      attributes: [
        ...sharedAttributes,
        jsonAttribute('langfuse.observation.input', rootInput),
        jsonAttribute('langfuse.observation.output', rootOutput)
      ]
    });
    const generation = span({
      traceId,
      spanId: generationSpanId,
      parentSpanId: rootSpanId,
      name: 'morning-briefing.llm',
      startedAt: trace.startedAt,
      completedAt: trace.completedAt,
      attributes: [
        ...sharedAttributes,
        stringAttribute('langfuse.observation.type', 'generation'),
        stringAttribute('langfuse.observation.model.name', trace.model),
        jsonAttribute('langfuse.observation.input', rootInput),
        jsonAttribute('langfuse.observation.output', rootOutput)
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
              resource: {
                attributes: [stringAttribute('service.name', 'doma-convex')]
              },
              scopeSpans: [
                {
                  scope: { name: 'doma.morning-briefing' },
                  spans: [root, generation]
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        console.warn('[briefing.langfuse] Trace export was rejected', { status: response.status });
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn('[briefing.langfuse] Trace export failed', {
      error: error instanceof Error ? error.name : 'unknown_error'
    });
  }
}

function traceAttributes({ config, trace }: { config: LangfuseConfig; trace: MorningBriefingGenerationTrace }) {
  return [
    stringAttribute('langfuse.trace.name', 'morning-briefing.generation'),
    stringAttribute('langfuse.trace.metadata.briefing_kind', 'morning'),
    stringAttribute('langfuse.trace.metadata.generation_status', trace.output.generationStatus),
    stringAttribute('langfuse.trace.metadata.local_date', trace.output.localDate),
    ...(config.environment ? [stringAttribute('langfuse.environment', config.environment)] : [])
  ];
}

function inputSummary(input: MorningBriefingAiInput) {
  return {
    localDate: input.localDate,
    timeZone: input.timeZone,
    sourceCount: input.sources.length,
    dailyRequirementSourceCount: input.sources.filter((source) => source.kind === 'dailyRequirements').length,
    scheduleSourceCount: input.sources.filter((source) => source.kind === 'schedule').length,
    weatherAvailable: input.weather !== undefined
  };
}

function outputSummary(output: DeterministicMorningBriefing) {
  return {
    generationStatus: output.generationStatus,
    shouldSend: output.briefing.shouldSend,
    morningLineCount: output.briefing.morning.length,
    afternoonLineCount: output.briefing.afternoon.length,
    watchoutCount: output.briefing.watchouts.length,
    sourceIdCount: output.sourceIds.length
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

function jsonAttribute(key: string, value: unknown): OtelAttribute {
  return stringAttribute(key, JSON.stringify(value));
}
