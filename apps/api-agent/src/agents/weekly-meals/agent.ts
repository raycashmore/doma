import type { LanguageModel } from 'ai';
import { Output, stepCountIs, ToolLoopAgent } from 'ai';

import { weeklyMealsModelOutputSchema } from './schemas.js';
import type { createWeeklyMealsTools } from './tools.js';

export const WEEKLY_MEALS_PROMPT_VERSION = 'weekly-meals-v2';
export const WEEKLY_MEALS_STEP_LIMIT = 6;

export const weeklyMealsInstructions = `You plan Monday-to-Friday school lunches and dinners from saved household recipes.

Before proposing anything, call all three available read-only tools. Propose assignments only for returned open slots and reference only recipe IDs returned by listSavedRecipes. A school-lunch slot requires the "School lunch" tag and a dinner slot requires the "Dinner" tag. Treat weekday busyness as a soft constraint and prefer recipes tagged "Quick" on busy days. Prefer variety when enough suitable recipes exist, but repetition is allowed when coverage is small. Never claim a repeated recipe is leftovers. Never invent recipes, ingredients, quantities, pantry state, or occupied-slot changes.

If no slots are open or the available recipes cannot safely cover them, return cannotPropose with a concise reason and an empty assignments array. Otherwise return a proposal with one short grounded reason per assignment and an empty top-level reason.`;

export function createWeeklyMealsAgent({
  model,
  tools,
  onStepFinish
}: {
  model: LanguageModel;
  tools: ReturnType<typeof createWeeklyMealsTools>;
  onStepFinish: () => void;
}) {
  return new ToolLoopAgent({
    id: 'weekly-meals',
    model,
    instructions: weeklyMealsInstructions,
    tools,
    output: Output.object({
      name: 'weeklyMealPlanOutcome',
      description: 'A grounded proposal for open slots or a safe cannot-propose outcome.',
      schema: weeklyMealsModelOutputSchema
    }),
    stopWhen: stepCountIs(WEEKLY_MEALS_STEP_LIMIT),
    onStepFinish
  });
}
