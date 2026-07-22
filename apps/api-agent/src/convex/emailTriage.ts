import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

import type { EmailTriageRunInput } from '../agents/email-triage/schemas.js';
import type { EmailTriageRunTrace } from '../agents/email-triage/trace.js';
import type { AgentConfig } from '../config.js';

const claimedInput = makeFunctionReference<
  'query',
  { serviceToken: string; capturedEmailId: string },
  EmailTriageRunInput | null
>('email/agentContext:claimedInput');

const recordRun = makeFunctionReference<
  'mutation',
  Record<string, unknown> & { serviceToken: string },
  { runId: string }
>('email/agentContext:recordRun');

export function createEmailTriageConvex(config: AgentConfig, capturedEmailId: string) {
  const client = new ConvexHttpClient(config.convexUrl);
  return {
    loadInput: () =>
      client.query(claimedInput, {
        serviceToken: config.agentServiceToken,
        capturedEmailId
      }),
    saveTrace: async (trace: EmailTriageRunTrace) => {
      await client.mutation(recordRun, {
        serviceToken: config.agentServiceToken,
        runId: trace.runId,
        capturedEmailId: trace.capturedEmailId,
        model: trace.model,
        promptVersion: trace.promptVersion,
        startedAt: trace.startedAt,
        completedAt: trace.completedAt,
        expiresAt: trace.expiresAt,
        stopReason: trace.stopReason,
        ...(trace.error
          ? {
              errorName: trace.error.name,
              ...(trace.error.message ? { errorMessage: trace.error.message } : {}),
              ...(trace.error.statusCode === undefined ? {} : { errorStatusCode: trace.error.statusCode }),
              ...(trace.error.type ? { errorType: trace.error.type } : {}),
              ...(trace.error.generationId ? { errorGenerationId: trace.error.generationId } : {})
            }
          : {}),
        inputTokens: trace.tokenUsage.input,
        outputTokens: trace.tokenUsage.output,
        outcomeKind: trace.outcomeKind,
        hasObligation: trace.hasObligation,
        validationStatus: trace.validation.status,
        ...(trace.validation.status === 'invalid' ? { validationReason: trace.validation.reason } : {})
      });
    }
  };
}
