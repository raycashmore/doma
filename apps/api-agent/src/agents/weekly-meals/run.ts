import { randomUUID } from 'node:crypto';

import type { LanguageModel } from 'ai';

import { createWeeklyMealsAgent, WEEKLY_MEALS_PROMPT_VERSION } from './agent.js';
import type { MealSlot, SavedRecipe, WeeklyMealsOutcome, WeeklyMealsRunInput } from './schemas.js';
import { mealTypes, weekdays, weeklyMealsRunInputSchema } from './schemas.js';
import type { WeeklyMealsToolDependencies } from './tools.js';
import { createWeeklyMealsTools } from './tools.js';
import type { WeeklyMealsRunTrace } from './trace.js';
import { createWeeklyMealsTrace, WEEKLY_MEALS_TRACE_RETENTION_MS } from './trace.js';

const unavailableOutcome: WeeklyMealsOutcome = {
  kind: 'cannotPropose',
  reason: 'A grounded meal proposal could not be produced from the available week and recipes.'
};

function modelName(model: LanguageModel) {
  return typeof model === 'string' ? model : model.modelId;
}

function slotKey(slot: MealSlot) {
  return `${slot.day}:${slot.meal}`;
}

function validateProposal({
  outcome,
  input,
  snapshot
}: {
  outcome: WeeklyMealsOutcome;
  input: WeeklyMealsRunInput;
  snapshot: WeeklyMealsRunTrace['inputSnapshot'];
}): { status: 'valid' } | { status: 'invalid'; reason: string } {
  if (!snapshot.openMealSlots || !snapshot.recipes || !snapshot.busyness) {
    return { status: 'invalid', reason: 'required_tools_not_completed' };
  }
  if (
    snapshot.openMealSlots.weekStart !== input.weekStart ||
    snapshot.openMealSlots.planUpdatedAt !== input.expectedPlanUpdatedAt
  ) {
    return { status: 'invalid', reason: 'planning_snapshot_changed' };
  }
  if (outcome.kind === 'cannotPropose') return { status: 'valid' };

  const openSlots = new Set(snapshot.openMealSlots.slots.map(slotKey));
  const recipes = new Map(snapshot.recipes.map((recipe) => [recipe.publicId, recipe]));
  const proposedSlots = new Set<string>();
  for (const assignment of outcome.assignments) {
    const key = slotKey(assignment);
    if (!openSlots.has(key)) return { status: 'invalid', reason: 'occupied_or_unknown_slot' };
    if (proposedSlots.has(key)) return { status: 'invalid', reason: 'duplicate_slot' };
    proposedSlots.add(key);

    const recipe = recipes.get(assignment.recipePublicId);
    if (!recipe) return { status: 'invalid', reason: 'unknown_recipe' };
    const requiredTag = assignment.meal === 'schoolLunch' ? 'School lunch' : 'Dinner';
    if (!recipe.mealSuitabilityTags.includes(requiredTag)) {
      return { status: 'invalid', reason: 'unsuitable_recipe' };
    }
    if (/\bleftovers?\b/i.test(assignment.reason)) {
      return { status: 'invalid', reason: 'unsupported_leftovers_claim' };
    }
  }
  return { status: 'valid' };
}

function planningPrompt(input: WeeklyMealsRunInput) {
  return [
    `Plan open meal slots for the week beginning ${input.weekStart}.`,
    input.instruction ? `One-off household instruction: ${input.instruction}` : 'There is no one-off instruction.',
    'Use the tools for all planning context and return the typed outcome.'
  ].join('\n');
}

export async function runWeeklyMealsAgent({
  model,
  input: rawInput,
  tools: dependencies,
  saveTrace,
  createRunId = () => `run_${randomUUID()}`,
  now = Date.now
}: {
  model: LanguageModel;
  input: WeeklyMealsRunInput;
  tools: WeeklyMealsToolDependencies;
  saveTrace: (trace: WeeklyMealsRunTrace) => Promise<void> | void;
  createRunId?: () => string;
  now?: () => number;
}) {
  const input = weeklyMealsRunInputSchema.parse(rawInput);
  const runId = createRunId();
  const startedAt = now();
  const partialTrace = createWeeklyMealsTrace({
    runId,
    input,
    model: modelName(model),
    promptVersion: WEEKLY_MEALS_PROMPT_VERSION,
    startedAt
  });
  let stepCount = 0;
  const agentTools = createWeeklyMealsTools({
    dependencies,
    now,
    trace: {
      record: (toolCall) => partialTrace.toolCalls.push(toolCall),
      setOpenMealSlots: (value) => {
        partialTrace.inputSnapshot.openMealSlots = value;
      },
      setRecipes: (value) => {
        partialTrace.inputSnapshot.recipes = value;
      },
      setBusyness: (value) => {
        partialTrace.inputSnapshot.busyness = value;
      }
    }
  });
  const agent = createWeeklyMealsAgent({
    model,
    tools: agentTools,
    onStepFinish: () => {
      stepCount += 1;
    }
  });

  let outcome: WeeklyMealsOutcome = unavailableOutcome;
  let stopReason = 'error';
  let tokenUsage = { input: 0, output: 0 };
  let validation: WeeklyMealsRunTrace['validation'] = { status: 'invalid', reason: 'agent_failed' };
  try {
    const result = await agent.generate({ prompt: planningPrompt(input), timeout: { totalMs: 30_000 } });
    outcome = result.output;
    stopReason = result.finishReason;
    tokenUsage = {
      input: result.totalUsage.inputTokens ?? 0,
      output: result.totalUsage.outputTokens ?? 0
    };
    validation = validateProposal({ outcome, input, snapshot: partialTrace.inputSnapshot });
    if (validation.status === 'invalid') outcome = unavailableOutcome;
  } catch (error) {
    stopReason = error instanceof Error ? error.name : 'error';
  }

  const completedAt = now();
  const trace: WeeklyMealsRunTrace = {
    ...partialTrace,
    completedAt,
    expiresAt: startedAt + WEEKLY_MEALS_TRACE_RETENTION_MS,
    stepCount,
    stopReason,
    tokenUsage,
    outcome,
    validation
  };
  await saveTrace(trace);
  return { runId, outcome };
}

export const weeklyMealsAgentVocabulary = { weekdays, mealTypes };
export type { SavedRecipe };
