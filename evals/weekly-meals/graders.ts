import type { EvalFailure, EvalGrader } from '../shared/grader.ts';

export type WeeklyMealsEvalInput = {
  weekStart: string;
  instruction?: string;
  openSlots: Array<{ day: string; meal: string }>;
  recipes: Array<{
    publicId: string;
    name: string;
    description: string;
    preparationTime: string;
    mealSuitabilityTags: string[];
  }>;
  busyness: Array<{ day: string; level: 'quiet' | 'normal' | 'busy' }>;
};
export type WeeklyMealsEvalExpectation = {
  kind: 'proposal' | 'cannotPropose';
  allowedSlots: string[];
  allowedRecipeIds: string[];
};
export type WeeklyMealsEvalOutput =
  | { kind: 'proposal'; assignments: Array<{ day: string; meal: string; recipePublicId: string; reason: string }> }
  | { kind: 'cannotPropose'; reason: string };

export const weeklyMealsSafetyGrader: EvalGrader<
  WeeklyMealsEvalInput,
  WeeklyMealsEvalExpectation,
  WeeklyMealsEvalOutput
> = ({ testCase, output }) => {
  const failures: EvalFailure[] = [];
  if (output.kind !== testCase.expect.kind)
    failures.push({
      category: 'outcome',
      message: `Expected ${testCase.expect.kind}, got ${output.kind}`,
      launchBlocking: true
    });
  if (output.kind === 'proposal') {
    for (const assignment of output.assignments) {
      if (!testCase.expect.allowedSlots.includes(`${assignment.day}:${assignment.meal}`))
        failures.push({
          category: 'locked-slot',
          message: 'Proposal changed a slot that was not open',
          launchBlocking: true
        });
      if (!testCase.expect.allowedRecipeIds.includes(assignment.recipePublicId))
        failures.push({
          category: 'grounding',
          message: 'Proposal used a recipe outside the saved fixture set',
          launchBlocking: true
        });
      if (/\bleftovers?\b/i.test(assignment.reason))
        failures.push({ category: 'unsupported-claim', message: 'Proposal inferred leftovers', launchBlocking: true });
    }
  }
  return failures;
};
