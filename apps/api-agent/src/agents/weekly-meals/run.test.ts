import { GatewayForbiddenError, GatewayInternalServerError } from '@ai-sdk/gateway';
import { RetryError } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';

import { runWeeklyMealsAgent, validateProposal } from './run.js';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 6, text: 6, reasoning: undefined }
};

describe('runWeeklyMealsAgent', () => {
  it('rejects proposals that omit any open slot', () => {
    expect(
      validateProposal({
        input: { userId: 'user_123', weekStart: '2026-07-20', expectedPlanUpdatedAt: 42 },
        outcome: {
          kind: 'proposal',
          assignments: [
            {
              day: 'monday',
              meal: 'dinner',
              recipePublicId: 'recipe_pasta',
              reason: 'A saved dinner recipe.'
            }
          ]
        },
        snapshot: {
          openMealSlots: {
            weekStart: '2026-07-20',
            planUpdatedAt: 42,
            slots: [
              { day: 'monday', meal: 'dinner' },
              { day: 'tuesday', meal: 'dinner' }
            ]
          },
          recipes: [
            {
              publicId: 'recipe_pasta',
              name: 'Vegetable pasta',
              description: 'A saved dinner.',
              preparationTime: '30 minutes',
              mealSuitabilityTags: ['Dinner'],
              updatedAt: 40
            }
          ],
          busyness: [
            { day: 'monday', level: 'normal' },
            { day: 'tuesday', level: 'normal' }
          ]
        }
      })
    ).toEqual({ status: 'invalid', reason: 'incomplete_slot_coverage' });
  });

  it('recognizes a complete week without invoking the model or unnecessary tools', async () => {
    const doGenerate = vi.fn();
    const model = new MockLanguageModelV3({ modelId: 'test/weekly-meals', doGenerate });
    const saveTrace = vi.fn();
    const listSavedRecipes = vi.fn();
    const getWeekBusyness = vi.fn();

    const result = await runWeeklyMealsAgent({
      model,
      input: { userId: 'user_123', weekStart: '2026-07-20', expectedPlanUpdatedAt: 42 },
      tools: {
        getOpenMealSlots: async () => ({ weekStart: '2026-07-20', planUpdatedAt: 42, slots: [] }),
        listSavedRecipes,
        getWeekBusyness
      },
      saveTrace,
      createRunId: () => 'run_complete',
      now: () => 1_700_000_000_000
    });

    expect(result).toEqual({
      runId: 'run_complete',
      outcome: { kind: 'cannotPropose', reason: 'There are no empty weekday meal slots to fill.' }
    });
    expect(doGenerate).not.toHaveBeenCalled();
    expect(listSavedRecipes).not.toHaveBeenCalled();
    expect(getWeekBusyness).not.toHaveBeenCalled();
    expect(saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({ stopReason: 'no_open_slots', stepCount: 0, validation: { status: 'valid' } })
    );
  });

  it('records privacy-safe gateway failure details in the trace and runtime log', async () => {
    const gatewayError = new GatewayForbiddenError({
      message: 'AI Gateway credits are required.',
      statusCode: 403,
      generationId: 'generation_123'
    });
    const model = new MockLanguageModelV3({
      modelId: 'openai/gpt-5.4-mini',
      doGenerate: async () => {
        throw gatewayError;
      }
    });
    const saveTrace = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await runWeeklyMealsAgent({
      model,
      input: {
        userId: 'user_private',
        weekStart: '2026-07-20',
        expectedPlanUpdatedAt: null,
        instruction: 'Private household instruction.'
      },
      tools: {
        getOpenMealSlots: async () => ({
          weekStart: '2026-07-20',
          planUpdatedAt: null,
          slots: [{ day: 'monday', meal: 'dinner' }]
        }),
        listSavedRecipes: async () => [],
        getWeekBusyness: async () => []
      },
      saveTrace,
      createRunId: () => 'run_failed',
      now: () => 1_700_000_000_000
    });

    const error = {
      name: 'GatewayForbiddenError',
      message: 'AI Gateway credits are required. [generation_123]',
      statusCode: 403,
      type: 'forbidden',
      generationId: 'generation_123'
    };
    expect(result.outcome.kind).toBe('cannotPropose');
    expect(saveTrace).toHaveBeenCalledWith(expect.objectContaining({ stopReason: 'GatewayForbiddenError', error }));
    const logEntry = {
      level: 'error',
      message: 'weekly_meals_agent_failed',
      runId: 'run_failed',
      model: 'openai/gpt-5.4-mini',
      error
    } as const;
    expect(consoleError).toHaveBeenCalledWith(JSON.stringify(logEntry));
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('user_private');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('Private household instruction.');
    consoleError.mockRestore();
  });

  it('does not retain messages from status-bearing non-gateway errors', async () => {
    const model = new MockLanguageModelV3({
      modelId: 'openai/gpt-5.4-mini',
      doGenerate: async () => {
        throw Object.assign(new Error('Private household instruction.'), {
          name: 'APICallError',
          statusCode: 400
        });
      }
    });
    const saveTrace = vi.fn();
    const logError = vi.fn();

    await runWeeklyMealsAgent({
      model,
      input: { userId: 'user_private', weekStart: '2026-07-20', expectedPlanUpdatedAt: null },
      tools: {
        getOpenMealSlots: async () => ({
          weekStart: '2026-07-20',
          planUpdatedAt: null,
          slots: [{ day: 'monday', meal: 'dinner' }]
        }),
        listSavedRecipes: async () => [],
        getWeekBusyness: async () => []
      },
      saveTrace,
      logError,
      createRunId: () => 'run_non_gateway'
    });

    expect(saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({ error: { name: 'APICallError', statusCode: 400 } })
    );
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ error: { name: 'APICallError', statusCode: 400 } })
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain('Private household instruction.');
  });

  it('unwraps retry errors to retain the final gateway failure', async () => {
    const gatewayError = new GatewayInternalServerError({
      message: 'Provider temporarily unavailable.',
      statusCode: 500,
      generationId: 'generation_retry'
    });
    const retryError = new RetryError({
      message: 'Failed after retries.',
      reason: 'maxRetriesExceeded',
      errors: [gatewayError]
    });
    const model = new MockLanguageModelV3({
      modelId: 'openai/gpt-5.4-mini',
      doGenerate: async () => {
        throw retryError;
      }
    });
    const saveTrace = vi.fn();
    const logError = vi.fn();

    await runWeeklyMealsAgent({
      model,
      input: { userId: 'user_private', weekStart: '2026-07-20', expectedPlanUpdatedAt: null },
      tools: {
        getOpenMealSlots: async () => ({
          weekStart: '2026-07-20',
          planUpdatedAt: null,
          slots: [{ day: 'monday', meal: 'dinner' }]
        }),
        listSavedRecipes: async () => [],
        getWeekBusyness: async () => []
      },
      saveTrace,
      logError,
      createRunId: () => 'run_retry'
    });

    const error = {
      name: 'GatewayInternalServerError',
      message: 'Provider temporarily unavailable. [generation_retry]',
      statusCode: 500,
      type: 'internal_server_error',
      generationId: 'generation_retry'
    };
    expect(saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({ stopReason: 'GatewayInternalServerError', error })
    );
    expect(logError).toHaveBeenCalledWith(expect.objectContaining({ error }));
  });

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
            mealSuitabilityTags: ['School lunch', 'Quick'],
            updatedAt: 40
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

  it.each([
    {
      name: 'an unsupported leftovers claim',
      reason: 'Use leftovers from Sunday.',
      validationReason: 'unsupported_leftovers_claim'
    },
    {
      name: 'an ungrounded pantry claim',
      reason: 'The pantry has every ingredient and enough servings.',
      validationReason: 'ungrounded_reason'
    }
  ])('fails closed when model output makes $name', async ({ reason, validationReason }) => {
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
                        reason
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
            mealSuitabilityTags: ['Dinner'],
            updatedAt: 40
          }
        ],
        getWeekBusyness: async () => [{ day: 'monday', level: 'normal' }]
      },
      saveTrace
    });

    expect(result.outcome.kind).toBe('cannotPropose');
    expect(saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({ validation: { status: 'invalid', reason: validationReason } })
    );
  });
});
