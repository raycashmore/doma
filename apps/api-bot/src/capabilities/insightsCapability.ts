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

/**
 * The insights capability answers natural-language questions about the stored
 * monthly spending insights. It runs in-process (no HTTP endpoint) and calls a
 * Convex action that grounds the answer in the stored latest insight; the
 * injected `answerQuestion` keeps unit tests off the network.
 */
export function createInsightsCapability({
  answerQuestion
}: {
  answerQuestion: AnswerSpendingInsightQuestion;
}): CapabilityHandler {
  return async (request) => {
    const result = await answerQuestion(request.messageText);

    if (result.status === 'answered' && typeof result.answer === 'string') {
      return { kind: 'reply', text: result.answer };
    }

    if (result.status === 'no_insight') {
      return { kind: 'reply', text: NO_INSIGHT_REPLY };
    }

    return CAPABILITY_FALLBACK_RESPONSE;
  };
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
