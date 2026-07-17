import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';

import { runWeeklyMealsAgent } from './run.js';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 6, text: 6, reasoning: undefined }
};

describe('runWeeklyMealsAgent', () => {
  it('uses the three read-only tools and stores a grounded typed proposal trace', async () => {
    let generation = 0;
    const model = new MockLanguageModelV3({
      modelId: 'test/weekly-meals',
      doGenerate: async () => {
        generation += 1;
        if (generation === 1) {
          return {
            content: [
              { type: 'tool-call', toolCallId: 'slots-1', toolName: 'getOpenMealSlots', input: '{}' },
              { type: 'tool-call', toolCallId: 'recipes-1', toolName: 'listSavedRecipes', input: '{}' },
              { type: 'tool-call', toolCallId: 'busy-1', toolName: 'getWeekBusyness', input: '{}' }
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
            usage,
            warnings: []
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                kind: 'proposal',
                assignments: [
                  {
                    day: 'monday',
                    meal: 'schoolLunch',
                    recipePublicId: 'recipe_wraps',
                    reason: 'A saved school-lunch recipe that suits the busy day.'
                  }
                ]
              })
            }
          ],
          finishReason: { unified: 'stop', raw: undefined },
          usage,
          warnings: []
        };
      }
    });
    const saveTrace = vi.fn();

    const result = await runWeeklyMealsAgent({
      model,
      input: {
        userId: 'user_123',
        weekStart: '2026-07-20',
        expectedPlanUpdatedAt: 42,
        instruction: 'Keep lunches quick.'
      },
      tools: {
        getOpenMealSlots: async () => ({
          weekStart: '2026-07-20',
          planUpdatedAt: 42,
          slots: [{ day: 'monday', meal: 'schoolLunch' }]
        }),
        listSavedRecipes: async () => [
          {
            publicId: 'recipe_wraps',
            name: 'Vegetable wraps',
            description: 'A quick packed lunch.',
            preparationTime: '15 minutes',
            mealSuitabilityTags: ['School lunch', 'Quick']
          }
        ],
        getWeekBusyness: async () => [{ day: 'monday', level: 'busy' }]
      },
      saveTrace,
      createRunId: () => 'run_123',
      now: () => 1_700_000_000_000
    });

    expect(result).toEqual({
      runId: 'run_123',
      outcome: {
        kind: 'proposal',
        assignments: [
          {
            day: 'monday',
            meal: 'schoolLunch',
            recipePublicId: 'recipe_wraps',
            reason: 'A saved school-lunch recipe that suits the busy day.'
          }
        ]
      }
    });
    expect(saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run_123',
        userId: 'user_123',
        model: 'test/weekly-meals',
        promptVersion: expect.any(String),
        outcome: result.outcome,
        validation: { status: 'valid' },
        stepCount: 2,
        toolCalls: expect.arrayContaining([
          expect.objectContaining({ toolName: 'getOpenMealSlots', status: 'success' }),
          expect.objectContaining({ toolName: 'listSavedRecipes', status: 'success' }),
          expect.objectContaining({ toolName: 'getWeekBusyness', status: 'success' })
        ]),
        startedAt: 1_700_000_000_000,
        expiresAt: 1_702_592_000_000
      })
    );
  });

  it('fails closed when model output makes an unsupported leftovers claim', async () => {
    let generation = 0;
    const model = new MockLanguageModelV3({
      modelId: 'test/weekly-meals',
      doGenerate: async () => {
        generation += 1;
        return generation === 1
          ? {
              content: [
                { type: 'tool-call', toolCallId: 'slots-1', toolName: 'getOpenMealSlots', input: '{}' },
                { type: 'tool-call', toolCallId: 'recipes-1', toolName: 'listSavedRecipes', input: '{}' },
                { type: 'tool-call', toolCallId: 'busy-1', toolName: 'getWeekBusyness', input: '{}' }
              ],
              finishReason: { unified: 'tool-calls' as const, raw: undefined },
              usage,
              warnings: []
            }
          : {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({
                    kind: 'proposal',
                    assignments: [
                      {
                        day: 'monday',
                        meal: 'dinner',
                        recipePublicId: 'recipe_pasta',
                        reason: 'Use leftovers from Sunday.'
                      }
                    ]
                  })
                }
              ],
              finishReason: { unified: 'stop' as const, raw: undefined },
              usage,
              warnings: []
            };
      }
    });
    const saveTrace = vi.fn();
    const result = await runWeeklyMealsAgent({
      model,
      input: { userId: 'user_123', weekStart: '2026-07-20', expectedPlanUpdatedAt: null },
      tools: {
        getOpenMealSlots: async () => ({
          weekStart: '2026-07-20',
          planUpdatedAt: null,
          slots: [{ day: 'monday', meal: 'dinner' }]
        }),
        listSavedRecipes: async () => [
          {
            publicId: 'recipe_pasta',
            name: 'Vegetable pasta',
            description: 'A saved dinner.',
            preparationTime: '30 minutes',
            mealSuitabilityTags: ['Dinner']
          }
        ],
        getWeekBusyness: async () => [{ day: 'monday', level: 'normal' }]
      },
      saveTrace
    });

    expect(result.outcome.kind).toBe('cannotPropose');
    expect(saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({ validation: { status: 'invalid', reason: 'unsupported_leftovers_claim' } })
    );
  });
});
