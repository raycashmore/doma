import { tool } from 'ai';
import { z } from 'zod';

import type { DayBusyness, OpenMealSlots, SavedRecipe } from './schemas.js';
import { dayBusynessSchema, openMealSlotsSchema, savedRecipeSchema } from './schemas.js';
import type { WeeklyMealsToolCallTrace } from './trace.js';

export type WeeklyMealsToolDependencies = {
  getOpenMealSlots: () => Promise<OpenMealSlots>;
  listSavedRecipes: () => Promise<SavedRecipe[]>;
  getWeekBusyness: () => Promise<DayBusyness[]>;
};

type ToolTraceSink = {
  record: (trace: WeeklyMealsToolCallTrace) => void;
  setOpenMealSlots: (value: OpenMealSlots) => void;
  setRecipes: (value: SavedRecipe[]) => void;
  setBusyness: (value: DayBusyness[]) => void;
};

async function executeTraced<T>({
  toolName,
  execute,
  onSuccess,
  trace,
  now
}: {
  toolName: WeeklyMealsToolCallTrace['toolName'];
  execute: () => Promise<T>;
  onSuccess: (value: T) => void;
  trace: ToolTraceSink;
  now: () => number;
}) {
  const startedAt = now();
  try {
    const output = await execute();
    onSuccess(output);
    trace.record({ toolName, status: 'success', durationMs: now() - startedAt, output });
    return output;
  } catch (error) {
    trace.record({
      toolName,
      status: 'error',
      durationMs: now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export function createWeeklyMealsTools({
  dependencies,
  trace,
  now
}: {
  dependencies: WeeklyMealsToolDependencies;
  trace: ToolTraceSink;
  now: () => number;
}) {
  const inputSchema = z.object({});
  return {
    getOpenMealSlots: tool({
      description: 'Read the empty weekday meal slots and current weekly-plan version.',
      inputSchema,
      outputSchema: openMealSlotsSchema,
      strict: true,
      execute: () =>
        executeTraced({
          toolName: 'getOpenMealSlots',
          execute: dependencies.getOpenMealSlots,
          onSuccess: trace.setOpenMealSlots,
          trace,
          now
        })
    }),
    listSavedRecipes: tool({
      description: 'List the approved saved Meals recipes available for planning.',
      inputSchema,
      outputSchema: z.array(savedRecipeSchema),
      strict: true,
      execute: () =>
        executeTraced({
          toolName: 'listSavedRecipes',
          execute: dependencies.listSavedRecipes,
          onSuccess: trace.setRecipes,
          trace,
          now
        })
    }),
    getWeekBusyness: tool({
      description: 'Read a privacy-safe quiet, normal, or busy signal for each weekday.',
      inputSchema,
      outputSchema: z.array(dayBusynessSchema),
      strict: true,
      execute: () =>
        executeTraced({
          toolName: 'getWeekBusyness',
          execute: dependencies.getWeekBusyness,
          onSuccess: trace.setBusyness,
          trace,
          now
        })
    })
  };
}
