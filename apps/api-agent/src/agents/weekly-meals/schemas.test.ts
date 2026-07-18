import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { weeklyMealsModelOutputSchema, weeklyMealsOutcomeFromModel } from './schemas.js';

describe('weeklyMealsModelOutputSchema', () => {
  it('generates an OpenAI-compatible root object schema', () => {
    const jsonSchema = z.toJSONSchema(weeklyMealsModelOutputSchema);

    expect(jsonSchema).toMatchObject({ type: 'object' });
    expect(jsonSchema).not.toHaveProperty('oneOf');
    expect(jsonSchema).not.toHaveProperty('anyOf');
  });

  it('rejects an empty cannot-propose reason at the domain boundary', () => {
    expect(() => weeklyMealsOutcomeFromModel({ kind: 'cannotPropose', assignments: [], reason: '' })).toThrow();
  });
});
