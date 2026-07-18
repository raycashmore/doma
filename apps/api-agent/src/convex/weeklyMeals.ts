import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

import type { WeeklyMealsRunTrace } from '../agents/weekly-meals/trace.js';
import type { AgentConfig } from '../config.js';

type PlanningContext = {
  openMealSlots: WeeklyMealsRunTrace['inputSnapshot']['openMealSlots'];
  recipes: NonNullable<WeeklyMealsRunTrace['inputSnapshot']['recipes']>;
  busyness: NonNullable<WeeklyMealsRunTrace['inputSnapshot']['busyness']>;
};

const planningContext = makeFunctionReference<
  'query',
  { serviceToken: string; weekStart: string; userId: string },
  PlanningContext
>('meals/agentContext:planningContext');

const recordRun = makeFunctionReference<
  'mutation',
  Record<string, unknown> & { serviceToken: string },
  { runId: string }
>('meals/agentContext:recordRun');

export function createWeeklyMealsConvex(config: AgentConfig, weekStart: string, userId: string) {
  const client = new ConvexHttpClient(config.convexUrl);
  let contextPromise: Promise<PlanningContext> | undefined;
  const readContext = () =>
    (contextPromise ??= client.query(planningContext, {
      serviceToken: config.agentServiceToken,
      weekStart,
      userId
    }));

  return {
    tools: {
      getOpenMealSlots: async () => {
        const context = await readContext();
        if (!context.openMealSlots) throw new Error('Weekly plan unavailable');
        return context.openMealSlots;
      },
      listSavedRecipes: async () => (await readContext()).recipes,
      getWeekBusyness: async () => (await readContext()).busyness
    },
    saveTrace: async (trace: WeeklyMealsRunTrace) => {
      await client.mutation(recordRun, {
        serviceToken: config.agentServiceToken,
        runId: trace.runId,
        userId: trace.userId,
        weekStart: trace.weekStart,
        expectedPlanUpdatedAt: trace.expectedPlanUpdatedAt,
        ...(trace.instruction ? { instruction: trace.instruction } : {}),
        model: trace.model,
        promptVersion: trace.promptVersion,
        startedAt: trace.startedAt,
        completedAt: trace.completedAt,
        expiresAt: trace.expiresAt,
        stepCount: trace.stepCount,
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
        toolCallsJson: JSON.stringify(trace.toolCalls),
        inputSnapshotJson: JSON.stringify(trace.inputSnapshot),
        outcome: trace.outcome,
        validationStatus: trace.validation.status,
        ...(trace.validation.status === 'invalid' ? { validationReason: trace.validation.reason } : {})
      });
    }
  };
}
