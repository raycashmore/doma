import { readFile } from 'node:fs/promises';

import { runWeeklyMealsAgent } from '../../apps/api-agent/src/agents/weekly-meals/run.ts';
import { loadJsonlDataset } from '../shared/dataset.ts';
import { runEvalCases } from '../shared/grader.ts';
import { renderScorecard, summarizeEvalResults } from '../shared/report.ts';
import { weeklyMealsSafetyGrader, type WeeklyMealsEvalExpectation, type WeeklyMealsEvalInput } from './graders.ts';

const model = process.env.WEEKLY_MEALS_AI_MODEL;
if (!model) throw new Error('WEEKLY_MEALS_AI_MODEL is required for the live weekly meals eval');
const content = await readFile(new URL('./dataset.jsonl', import.meta.url), 'utf8');
const cases = loadJsonlDataset<WeeklyMealsEvalInput, WeeklyMealsEvalExpectation>(content);
const traces: unknown[] = [];
const results = await runEvalCases({
  cases,
  execute: async (testCase) => {
    const result = await runWeeklyMealsAgent({
      model,
      input: {
        userId: 'eval_user',
        weekStart: testCase.input.weekStart,
        expectedPlanUpdatedAt: null,
        instruction: testCase.input.instruction
      },
      tools: {
        getOpenMealSlots: async () => ({
          weekStart: testCase.input.weekStart,
          planUpdatedAt: null,
          slots: testCase.input.openSlots as never
        }),
        listSavedRecipes: async () => testCase.input.recipes,
        getWeekBusyness: async () => testCase.input.busyness as never
      },
      saveTrace: (trace) => {
        traces.push(trace);
      }
    });
    return result.outcome;
  },
  graders: [weeklyMealsSafetyGrader]
});
console.log(renderScorecard('Weekly meals agent evals', summarizeEvalResults(results)));
console.log(`Privacy-safe traces captured in memory: ${traces.length}`);
if (results.some((result) => result.status === 'fail')) process.exitCode = 1;
