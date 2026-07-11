import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runMealPlanningEvals } from './meal-planning.ts';

describe('weekly meal-planning evals', () => {
  it('keeps generic grounding and safety cases launch-ready', async () => {
    const { summary } = await runMealPlanningEvals();

    assert.equal(summary.launchBlockers, 0);
  });
});
