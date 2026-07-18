import type { DayBusyness, OpenMealSlots, SavedRecipe, WeeklyMealsOutcome, WeeklyMealsRunInput } from './schemas.js';

export const WEEKLY_MEALS_TRACE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type WeeklyMealsToolCallTrace = {
  toolName: 'getOpenMealSlots' | 'listSavedRecipes' | 'getWeekBusyness';
  status: 'success' | 'error';
  durationMs: number;
  output?: unknown;
  error?: string;
};

export type WeeklyMealsAgentError = {
  name: string;
  message?: string;
  statusCode?: number;
  type?: string;
  generationId?: string;
};

export type WeeklyMealsRunTrace = {
  runId: string;
  userId: string;
  weekStart: string;
  expectedPlanUpdatedAt: number | null;
  instruction?: string;
  model: string;
  promptVersion: string;
  startedAt: number;
  completedAt: number;
  expiresAt: number;
  stepCount: number;
  stopReason: string;
  error?: WeeklyMealsAgentError;
  tokenUsage: { input: number; output: number };
  toolCalls: WeeklyMealsToolCallTrace[];
  inputSnapshot: {
    openMealSlots?: OpenMealSlots;
    recipes?: SavedRecipe[];
    busyness?: DayBusyness[];
  };
  outcome: WeeklyMealsOutcome;
  validation: { status: 'valid' } | { status: 'invalid'; reason: string };
};

export function createWeeklyMealsTrace({
  runId,
  input,
  model,
  promptVersion,
  startedAt
}: {
  runId: string;
  input: WeeklyMealsRunInput;
  model: string;
  promptVersion: string;
  startedAt: number;
}) {
  return {
    runId,
    userId: input.userId,
    weekStart: input.weekStart,
    expectedPlanUpdatedAt: input.expectedPlanUpdatedAt,
    instruction: input.instruction,
    model,
    promptVersion,
    startedAt,
    toolCalls: [] as WeeklyMealsToolCallTrace[],
    inputSnapshot: {} as WeeklyMealsRunTrace['inputSnapshot']
  };
}
