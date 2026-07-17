import { v } from 'convex/values';

import { mutation, type MutationCtx, query, type QueryCtx } from '../_generated/server';
import { planningHorizonRange, zonedDateStartMs } from '../schedule/week';
import { getWeekDates, WEEKDAYS, WEEKLY_MEAL_TYPES } from './model';
import { weeklyMealAgentOutcome } from './schema';

function requireAgentServiceToken(serviceToken: string) {
  const expectedToken = process.env.AGENT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) throw new Error('Unauthorized');
}

function busyLevel(durationHours: number) {
  return durationHours >= 6 ? ('busy' as const) : durationHours <= 2 ? ('quiet' as const) : ('normal' as const);
}

export async function readAgentPlanningContext(
  ctx: Pick<QueryCtx, 'db'>,
  args: { serviceToken: string; weekStart: string; userId: string }
) {
  requireAgentServiceToken(args.serviceToken);
  if (!args.userId) throw new Error('Unauthorized');
  const scheduleTimezone = process.env.SCHEDULE_TZ ?? 'UTC';
  const dates = getWeekDates(args.weekStart);
  const planningHorizon = planningHorizonRange(new Date(), scheduleTimezone);
  const targetWeekStart = zonedDateStartMs(args.weekStart, scheduleTimezone);
  if (targetWeekStart < Date.parse(planningHorizon.timeMin) || targetWeekStart >= Date.parse(planningHorizon.timeMax)) {
    throw new Error('Meal planning week is outside the available schedule horizon');
  }
  const [plan, recipes, events] = await Promise.all([
    ctx.db
      .query('weeklyMealPlans')
      .withIndex('by_week_start', (q) => q.eq('weekStart', args.weekStart))
      .unique(),
    ctx.db.query('recipes').withIndex('by_updated_at').order('desc').collect(),
    ctx.db.query('scheduleEvents').withIndex('by_start').collect()
  ]);
  const occupied = new Set(plan?.assignments.map(({ day, meal }) => `${day}:${meal}`) ?? []);

  return {
    openMealSlots: {
      weekStart: args.weekStart,
      planUpdatedAt: plan?.updatedAt ?? null,
      slots: WEEKDAYS.flatMap((day) =>
        WEEKLY_MEAL_TYPES.flatMap((meal) => (occupied.has(`${day}:${meal}`) ? [] : [{ day, meal }]))
      )
    },
    recipes: recipes.map(({ publicId, name, description, preparationTime, mealSuitabilityTags, updatedAt }) => ({
      publicId,
      name,
      description,
      preparationTime,
      mealSuitabilityTags,
      updatedAt
    })),
    busyness: WEEKDAYS.map((day, index) => {
      const start = zonedDateStartMs(dates[index] ?? '', scheduleTimezone);
      const end = start + 24 * 60 * 60 * 1000;
      const durationHours = events.reduce(
        (total, event) => total + Math.max(0, Math.min(event.end, end) - Math.max(event.start, start)) / 3_600_000,
        0
      );
      return { day, level: busyLevel(durationHours) };
    })
  };
}

export const planningContext = query({
  args: { serviceToken: v.string(), weekStart: v.string(), userId: v.string() },
  handler: readAgentPlanningContext
});

const traceArgs = {
  serviceToken: v.string(),
  runId: v.string(),
  userId: v.string(),
  weekStart: v.string(),
  expectedPlanUpdatedAt: v.union(v.number(), v.null()),
  instruction: v.optional(v.string()),
  model: v.string(),
  promptVersion: v.string(),
  startedAt: v.number(),
  completedAt: v.number(),
  expiresAt: v.number(),
  stepCount: v.number(),
  stopReason: v.string(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  toolCallsJson: v.string(),
  inputSnapshotJson: v.string(),
  outcome: weeklyMealAgentOutcome,
  validationStatus: v.union(v.literal('valid'), v.literal('invalid')),
  validationReason: v.optional(v.string())
};

type AgentRunArgs = {
  serviceToken: string;
  runId: string;
  userId: string;
  weekStart: string;
  expectedPlanUpdatedAt: number | null;
  instruction?: string;
  model: string;
  promptVersion: string;
  startedAt: number;
  completedAt: number;
  expiresAt: number;
  stepCount: number;
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
  toolCallsJson: string;
  inputSnapshotJson: string;
  outcome:
    | {
        kind: 'proposal';
        assignments: Array<{
          day: (typeof WEEKDAYS)[number];
          meal: (typeof WEEKLY_MEAL_TYPES)[number];
          recipePublicId: string;
          reason: string;
        }>;
      }
    | { kind: 'cannotPropose'; reason: string };
  validationStatus: 'valid' | 'invalid';
  validationReason?: string;
};

export async function recordAgentRun(ctx: Pick<MutationCtx, 'db'>, args: AgentRunArgs) {
  requireAgentServiceToken(args.serviceToken);
  const row = { ...args };
  Reflect.deleteProperty(row, 'serviceToken');
  const existing = await ctx.db
    .query('weeklyMealAgentRuns')
    .withIndex('by_run_id', (q) => q.eq('runId', row.runId))
    .unique();
  if (existing) throw new Error('Agent run already recorded');
  await ctx.db.insert('weeklyMealAgentRuns', row);
  return { runId: row.runId };
}

export const recordRun = mutation({ args: traceArgs, handler: recordAgentRun });
