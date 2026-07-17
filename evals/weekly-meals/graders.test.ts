import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { weeklyMealsSafetyGrader, type WeeklyMealsEvalInput, type WeeklyMealsEvalExpectation } from './graders.ts';

const testCase = {
  id: 'safety',
  input: {} as WeeklyMealsEvalInput,
  expect: {
    kind: 'proposal',
    allowedSlots: ['friday:dinner'],
    allowedRecipeIds: ['recipe_saved']
  } as WeeklyMealsEvalExpectation
};

describe('weeklyMealsSafetyGrader', () => {
  it('launch-blocks locked slots, unknown recipes, and unsupported leftover claims', async () => {
    const failures = await weeklyMealsSafetyGrader({
      testCase,
      output: {
        kind: 'proposal',
        assignments: [{ day: 'monday', meal: 'dinner', recipePublicId: 'recipe_unknown', reason: 'Uses leftovers.' }]
      }
    });
    assert.deepEqual(
      failures.map((failure) => failure.category),
      ['locked-slot', 'grounding', 'unsupported-claim']
    );
    assert.ok(failures.every((failure) => failure.launchBlocking));
  });
});
