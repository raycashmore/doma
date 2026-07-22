export const EMAIL_TRIAGE_TRACE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type EmailTriageAgentError = {
  name: string;
  message?: string;
  statusCode?: number;
  type?: string;
  generationId?: string;
};

export type EmailTriageRunTrace = {
  runId: string;
  capturedEmailId: string;
  model: string;
  promptVersion: string;
  startedAt: number;
  completedAt: number;
  expiresAt: number;
  stopReason: string;
  error?: EmailTriageAgentError;
  tokenUsage: { input: number; output: number };
  outcomeKind: 'notice' | 'noNotice' | 'failed';
  hasObligation: boolean;
  validation: { status: 'valid' } | { status: 'invalid'; reason: 'invalid_ai_output' | 'provider_failure' };
};
