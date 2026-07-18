import { describe, expect, it, vi } from 'vitest';

import * as mealMutations from './mutations';

type ApplyProposal = (ctx: unknown, args: { runId: string }) => Promise<unknown>;

function applyProposalHandler(): ApplyProposal {
  const candidate = (mealMutations as Record<string, unknown>).applyWeeklyMealProposalHandler;
  if (typeof candidate === 'function') return candidate as ApplyProposal;
  return () => Promise.reject(new Error('applyWeeklyMealProposalHandler is not implemented'));
}

const recipes = [
  {
    _id: 'recipe_row_lunch',
    publicId: 'recipe_lunch',
    mealSuitabilityTags: ['School lunch', 'Quick'],
    updatedAt: 30
  },
  {
    _id: 'recipe_row_dinner',
    publicId: 'recipe_dinner',
    mealSuitabilityTags: ['Dinner'],
    updatedAt: 31
  }
];

const run = {
  _id: 'run_row_1',
  runId: 'run_123',
  userId: 'user_123',
  weekStart: '2026-07-20',
  expectedPlanUpdatedAt: 42,
  expiresAt: 2_000,
  validationStatus: 'valid',
  inputSnapshotJson: JSON.stringify({
    recipes: [
      { publicId: 'recipe_lunch', updatedAt: 30 },
      { publicId: 'recipe_dinner', updatedAt: 31 }
    ]
  }),
  outcome: {
    kind: 'proposal',
    assignments: [
      {
        day: 'monday',
        meal: 'schoolLunch',
        recipePublicId: 'recipe_lunch',
        reason: 'Quick for a busy day.'
      },
      {
        day: 'tuesday',
        meal: 'dinner',
        recipePublicId: 'recipe_dinner',
        reason: 'A saved dinner recipe.'
      }
    ]
  }
} as const;

type CtxOptions = {
  identity?: { subject: string } | null;
  planUpdatedAt?: number;
  planAssignments?: Array<{ day: string; meal: string; recipePublicId: string }>;
  recipeRows?: typeof recipes;
  runRow?: typeof run | (Omit<typeof run, 'appliedAt'> & { appliedAt: number });
};

function createCtx(options: CtxOptions = {}) {
  const {
    identity = { subject: 'user_123' },
    planUpdatedAt = 42,
    planAssignments = [{ day: 'monday', meal: 'dinner', recipePublicId: 'recipe_existing' }],
    recipeRows = recipes,
    runRow = run
  } = options;
  const plan = {
    _id: 'plan_row_1',
    weekStart: '2026-07-20',
    assignments: planAssignments,
    createdAt: 1,
    updatedAt: planUpdatedAt,
    updatedByUserId: 'user_456'
  };
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
  return {
    ctx: {
      auth: { getUserIdentity: async () => identity },
      db: {
        patch: async (id: string, patch: Record<string, unknown>) => patches.push({ id, patch }),
        insert: vi.fn(),
        query: (table: string) => ({
          withIndex: (_index: string, apply: (query: { eq: (_field: string, value: string) => string }) => unknown) => {
            let value = '';
            apply({
              eq: (_field, nextValue) => {
                value = nextValue;
                return nextValue;
              }
            });
            if (table === 'weeklyMealAgentRuns')
              return { unique: async () => (value === runRow.runId ? runRow : null) };
            if (table === 'weeklyMealPlans') return { unique: async () => (value === plan.weekStart ? plan : null) };
            if (table === 'recipes') {
              return { unique: async () => recipeRows.find((recipe) => recipe.publicId === value) ?? null };
            }
            throw new Error(`Unexpected table ${table}`);
          }
        })
      }
    },
    patches
  };
}

describe('applyWeeklyMealProposalHandler', () => {
  it('atomically fills every proposed empty slot and marks the run applied', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const { ctx, patches } = createCtx();

    await expect(applyProposalHandler()(ctx, { runId: run.runId })).resolves.toMatchObject({
      weekStart: run.weekStart,
      assignments: expect.arrayContaining(
        run.outcome.assignments.map((assignment) => ({
          day: assignment.day,
          meal: assignment.meal,
          recipePublicId: assignment.recipePublicId
        }))
      )
    });

    expect(patches).toEqual([
      {
        id: 'plan_row_1',
        patch: {
          assignments: [
            { day: 'monday', meal: 'schoolLunch', recipePublicId: 'recipe_lunch' },
            { day: 'monday', meal: 'dinner', recipePublicId: 'recipe_existing' },
            { day: 'tuesday', meal: 'dinner', recipePublicId: 'recipe_dinner' }
          ],
          updatedAt: 1_000,
          updatedByUserId: 'user_123'
        }
      },
      { id: 'run_row_1', patch: { appliedAt: 1_000 } }
    ]);
  });

  it('rejects a stale proposal before writing any assignment', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const { ctx, patches } = createCtx({ planUpdatedAt: 43 });

    await expect(applyProposalHandler()(ctx, { runId: run.runId })).rejects.toThrow('Meal proposal is stale');
    expect(patches).toEqual([]);
  });

  it.each([
    {
      name: 'another user',
      options: { identity: { subject: 'user_456' } },
      error: 'Meal proposal unavailable'
    },
    {
      name: 'an already-applied run',
      options: { runRow: { ...run, appliedAt: 900 } },
      error: 'Meal proposal has already been applied'
    },
    {
      name: 'an unknown recipe',
      options: { recipeRows: [] },
      error: 'Recipe unavailable'
    },
    {
      name: 'a changed recipe',
      options: {
        recipeRows: recipes.map((recipe) =>
          recipe.publicId === 'recipe_lunch' ? { ...recipe, updatedAt: 99 } : recipe
        )
      },
      error: 'Meal proposal is stale'
    },
    {
      name: 'an unsuitable recipe',
      options: {
        recipeRows: recipes.map((recipe) =>
          recipe.publicId === 'recipe_lunch' ? { ...recipe, mealSuitabilityTags: ['Dinner'] } : recipe
        )
      },
      error: 'Recipe is not suitable for this meal'
    },
    {
      name: 'a newly occupied target slot',
      options: {
        planAssignments: [
          { day: 'monday', meal: 'dinner', recipePublicId: 'recipe_existing' },
          { day: 'monday', meal: 'schoolLunch', recipePublicId: 'recipe_other' }
        ]
      },
      error: 'Meal proposal is stale'
    }
  ])('rejects $name without partially writing', async ({ options, error }) => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const { ctx, patches } = createCtx(options);

    await expect(applyProposalHandler()(ctx, { runId: run.runId })).rejects.toThrow(error);
    expect(patches).toEqual([]);
  });

  it('rejects an expired proposal without writing', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const { ctx, patches } = createCtx();

    await expect(applyProposalHandler()(ctx, { runId: run.runId })).rejects.toThrow('Meal proposal has expired');
    expect(patches).toEqual([]);
  });
});
