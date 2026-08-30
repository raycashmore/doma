import { randomUUID } from 'node:crypto';

import { GatewayError } from '@ai-sdk/gateway';
import { type LanguageModel, NoObjectGeneratedError, RetryError } from 'ai';
import { ZodError } from 'zod';

import { EMAIL_TRIAGE_PROMPT_VERSION, generateEmailTriage } from './agent.js';
import type { EmailTriageGenerationTrace } from './langfuse.js';
import { emailTriageOutcomeFromModel, type EmailTriageRunInput, emailTriageRunInputSchema } from './schemas.js';
import { EMAIL_TRIAGE_TRACE_RETENTION_MS, type EmailTriageAgentError, type EmailTriageRunTrace } from './trace.js';

type EmailTriageErrorLog = {
  level: 'error';
  message: 'email_triage_agent_failed';
  runId: string;
  model: string;
  error: EmailTriageAgentError;
};

function modelName(model: LanguageModel) {
  return typeof model === 'string' ? model : model.modelId;
}

function normalizeErrorText(value: string) {
  return value.replace(/\s+/gu, ' ').trim();
}

function safeErrorMessage(error: unknown, input: EmailTriageRunInput) {
  if (!(error instanceof Error) || !error.message) return undefined;

  const privateValues = [
    input.subject,
    input.fromEmail,
    input.textBody,
    ...input.attachmentMetadata.flatMap((attachment) => [attachment.filename, attachment.contentType]),
    ...input.activeNoticeCandidates.flatMap((candidate) => [
      candidate.title,
      candidate.body,
      ...candidate.extractedFacts.flatMap((fact) => [fact.label, fact.value])
    ])
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeErrorText)
    .filter(Boolean);
  let message = normalizeErrorText(error.message);
  for (const value of privateValues) {
    if (value.length > 0) message = message.replaceAll(value, '[redacted]');
  }
  return message.slice(0, 500) || undefined;
}

function safeErrorDetails(error: unknown, input: EmailTriageRunInput): EmailTriageAgentError {
  const retryLastError = RetryError.isInstance(error) ? error.lastError : undefined;
  const gatewayError = GatewayError.isInstance(retryLastError)
    ? retryLastError
    : GatewayError.isInstance(error)
      ? error
      : undefined;
  if (gatewayError) {
    const message = safeErrorMessage(gatewayError, input);
    return {
      name: gatewayError.name,
      ...(message ? { message } : {}),
      statusCode: gatewayError.statusCode,
      type: gatewayError.type,
      ...(gatewayError.generationId ? { generationId: gatewayError.generationId } : {})
    };
  }

  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : undefined;
  const message = safeErrorMessage(error, input);
  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    ...(message ? { message } : {}),
    ...(statusCode === undefined ? {} : { statusCode })
  };
}

function defaultErrorLogger(entry: EmailTriageErrorLog) {
  console.error(JSON.stringify(entry));
}

function isInvalidModelOutput(error: unknown) {
  return NoObjectGeneratedError.isInstance(error) || error instanceof ZodError;
}

export async function runEmailTriageAgent({
  model,
  input: rawInput,
  saveTrace,
  onGenerationTrace,
  logError = defaultErrorLogger,
  createRunId = () => `email_run_${randomUUID()}`,
  now = Date.now
}: {
  model: LanguageModel;
  input: EmailTriageRunInput;
  saveTrace: (trace: EmailTriageRunTrace) => Promise<void> | void;
  onGenerationTrace?: (trace: EmailTriageGenerationTrace) => Promise<void> | void;
  logError?: (entry: EmailTriageErrorLog) => void;
  createRunId?: () => string;
  now?: () => number;
}) {
  const input = emailTriageRunInputSchema.parse(rawInput);
  const runId = createRunId();
  const startedAt = now();
  const modelId = modelName(model);

  try {
    const result = await generateEmailTriage({ model, input });
    const outcome = emailTriageOutcomeFromModel(
      result.output,
      new Set(input.activeNoticeCandidates.map((candidate) => candidate.id))
    );
    const completedAt = now();
    const trace = {
      runId,
      capturedEmailId: input.capturedEmailId,
      model: modelId,
      promptVersion: EMAIL_TRIAGE_PROMPT_VERSION,
      startedAt,
      completedAt,
      expiresAt: startedAt + EMAIL_TRIAGE_TRACE_RETENTION_MS,
      stopReason: result.finishReason,
      tokenUsage: {
        input: result.totalUsage.inputTokens ?? 0,
        output: result.totalUsage.outputTokens ?? 0
      },
      outcomeKind: outcome.kind,
      hasObligation: outcome.kind === 'notice' && outcome.obligation !== null,
      validation: { status: 'valid' }
    } satisfies EmailTriageRunTrace;
    await saveTrace(trace);
    await recordGenerationTrace(onGenerationTrace, {
      runId,
      model: modelId,
      promptVersion: EMAIL_TRIAGE_PROMPT_VERSION,
      startedAt,
      completedAt,
      input,
      output: outcome,
      stopReason: result.finishReason,
      tokenUsage: trace.tokenUsage,
      validation: trace.validation
    });
    return { runId, status: 'completed' as const, outcome };
  } catch (error) {
    const invalidOutput = isInvalidModelOutput(error);
    const reason = invalidOutput ? ('invalid_ai_output' as const) : ('provider_failure' as const);
    const errorDetails = safeErrorDetails(error, input);
    logError({
      level: 'error',
      message: 'email_triage_agent_failed',
      runId,
      model: modelId,
      error: errorDetails
    });
    const completedAt = now();
    const trace = {
      runId,
      capturedEmailId: input.capturedEmailId,
      model: modelId,
      promptVersion: EMAIL_TRIAGE_PROMPT_VERSION,
      startedAt,
      completedAt,
      expiresAt: startedAt + EMAIL_TRIAGE_TRACE_RETENTION_MS,
      stopReason: errorDetails.name,
      error: errorDetails,
      tokenUsage: { input: 0, output: 0 },
      outcomeKind: 'failed',
      hasObligation: false,
      validation: { status: 'invalid', reason }
    } satisfies EmailTriageRunTrace;
    await saveTrace(trace);
    await recordGenerationTrace(onGenerationTrace, {
      runId,
      model: modelId,
      promptVersion: EMAIL_TRIAGE_PROMPT_VERSION,
      startedAt,
      completedAt,
      input,
      output: null,
      stopReason: errorDetails.name,
      tokenUsage: trace.tokenUsage,
      validation: trace.validation,
      error: errorDetails
    });
    return { runId, status: 'failed' as const, reason };
  }
}

async function recordGenerationTrace(
  onGenerationTrace: ((trace: EmailTriageGenerationTrace) => Promise<void> | void) | undefined,
  trace: EmailTriageGenerationTrace
) {
  try {
    await onGenerationTrace?.(trace);
  } catch (error) {
    console.warn('[email-triage.run] Generation trace export failed', {
      error: error instanceof Error ? error.name : 'unknown_error'
    });
  }
}
