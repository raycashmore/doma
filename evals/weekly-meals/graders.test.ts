import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { weeklyMealsSafetyGrader, type WeeklyMealsEvalInput, type WeeklyMealsEvalExpectation } from './graders.ts';

const testCase = {
  id: 'safety',
  input: {
    weekStart: '2026-07-20',
    openSlots: [{ day: 'friday', meal: 'dinner' }],
    recipes: [],
    busyness: []
  } as WeeklyMealsEvalInput,
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
        outcome: {
          kind: 'proposal',
          assignments: [{ day: 'monday', meal: 'dinner', recipePublicId: 'recipe_unknown', reason: 'Uses leftovers.' }]
        },
        stepCount: 2,
        stopReason: 'stop'
      }
    });
    assert.deepEqual(
      failures.map((failure) => failure.category),
      ['locked-slot', 'grounding', 'unsupported-claim']
    );
    assert.ok(failures.every((failure) => failure.launchBlocking));
  });

  it('launch-blocks suitability, busy-fit, variety, unsupported claims, and step-limit regressions', async () => {
    const failures = await weeklyMealsSafetyGrader({
      testCase: {
        ...testCase,
        input: {
          weekStart: '2026-07-20',
          openSlots: [
            { day: 'monday', meal: 'schoolLunch' },
            { day: 'tuesday', meal: 'schoolLunch' }
          ],
          recipes: [
            {
              publicId: 'recipe_saved',
              name: 'Dinner bake',
              description: 'A saved recipe.',
              preparationTime: '45 minutes',
              mealSuitabilityTags: ['Dinner']
            },
            {
              publicId: 'recipe_quick',
              name: 'Quick wrap',
              description: 'A saved lunch.',
              preparationTime: '10 minutes',
              mealSuitabilityTags: ['School lunch', 'Quick']
            }
          ],
          busyness: [
            { day: 'monday', level: 'busy' },
            { day: 'tuesday', level: 'normal' }
          ]
        },
        expect: {
          kind: 'proposal',
          allowedSlots: ['monday:schoolLunch', 'tuesday:schoolLunch'],
          allowedRecipeIds: ['recipe_saved', 'recipe_quick'],
          requireVariety: true
        }
      },
      output: {
        outcome: {
          kind: 'proposal',
          assignments: [
            {
              day: 'monday',
              meal: 'schoolLunch',
              recipePublicId: 'recipe_saved',
              reason: 'The pantry has enough servings.'
            },
            {
              day: 'tuesday',
              meal: 'schoolLunch',
              recipePublicId: 'recipe_saved',
              reason: 'A saved recipe.'
            }
          ]
        },
        stepCount: 7,
        stopReason: 'step-limit'
      }
    });

    assert.deepEqual(
      [...new Set(failures.map((failure) => failure.category))],
      ['step-limit', 'unsupported-claim', 'suitability', 'busy-fit', 'variety']
    );
    assert.ok(failures.every((failure) => failure.launchBlocking));
  });
});
