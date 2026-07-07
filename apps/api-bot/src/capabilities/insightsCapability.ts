import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

import type { BotConfig } from '../config.js';
import type { CapabilityHandler } from '../dispatch/types.js';
import { CAPABILITY_FALLBACK_RESPONSE } from '../dispatch/types.js';

export type SpendingInsightAnswer =
  | { status: 'answered'; answer: string }
  | { status: 'no_insight' }
  | { status: 'setup_problem' }
  | { status: 'failed'; reason: 'provider_failure' | 'invalid_ai_output' };

export type AnswerSpendingInsightQuestion = (question: string) => Promise<SpendingInsightAnswer>;

export const NO_INSIGHT_REPLY =
  'There are no spending insights yet. The first one appears once a month of budget and card spend data is ready.';

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * The insights capability answers natural-language questions about the stored
 * monthly spending insights. It runs in-process (no HTTP endpoint) and calls a
 * Convex action that grounds the answer in the stored latest insight; the
 * injected `answerQuestion` keeps unit tests off the network. Answering is
 * bounded by `timeoutMs` because it runs inside the Telegram webhook handler.
 */
export function createInsightsCapability({
  answerQuestion,
  timeoutMs = DEFAULT_TIMEOUT_MS
}: {
  answerQuestion: AnswerSpendingInsightQuestion;
  timeoutMs?: number;
}): CapabilityHandler {
  return async (request) => {
    const result = await withTimeout(answerQuestion(request.messageText), timeoutMs);

    if (result === 'timed_out') {
      console.warn('[api-bot.capability] Insights answer timed out', { timeoutMs });
      return CAPABILITY_FALLBACK_RESPONSE;
    }

    if (result.status === 'answered' && typeof result.answer === 'string' && result.answer.trim().length > 0) {
      return { kind: 'reply', text: result.answer };
    }

    if (result.status === 'no_insight') {
      return { kind: 'reply', text: NO_INSIGHT_REPLY };
    }

    return CAPABILITY_FALLBACK_RESPONSE;
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | 'timed_out'> {
  let timeout: NodeJS.Timeout | undefined;
  const timedOut = new Promise<'timed_out'>((resolve) => {
    timeout = setTimeout(() => resolve('timed_out'), timeoutMs);
  });

  try {
    return await Promise.race([promise, timedOut]);
  } finally {
    clearTimeout(timeout);
  }
}

const answerSpendingInsightQuestionForBot = makeFunctionReference<
  'action',
  { serviceToken: string; question: string },
  SpendingInsightAnswer
>('insights/qa:answerSpendingInsightQuestionForBot');

export function createConvexInsightsAnswer(config: BotConfig): AnswerSpendingInsightQuestion {
  if (!config.convexUrl) {
    throw new Error('CONVEX_URL is required for the insights capability');
  }

  const client = new ConvexHttpClient(config.convexUrl);

  return (question) =>
    client.action(answerSpendingInsightQuestionForBot, {
      serviceToken: config.botServiceToken,
      question
    });
}
