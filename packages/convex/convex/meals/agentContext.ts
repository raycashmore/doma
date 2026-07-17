import { v } from 'convex/values';

import { mutation, type MutationCtx, query, type QueryCtx } from '../_generated/server';
import { getWeekDates, WEEKDAYS, WEEKLY_MEAL_TYPES } from './model';
import { weeklyMealAgentOutcome } from './schema';

function requireAgentServiceToken(serviceToken: string) {
  const expectedToken = process.env.AGENT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) throw new Error('Unauthorized');
}

function startOfCalendarDay(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getTime();
}

function weekdayForInstant(value: number) {
  const timeZone = process.env.SCHEDULE_TZ ?? 'UTC';
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(new Date(value)).toLowerCase();
}

function busyLevel(durationHours: number) {
  return durationHours >= 6 ? ('busy' as const) : durationHours <= 2 ? ('quiet' as const) : ('normal' as const);
}

export async function readAgentPlanningContext(
  ctx: Pick<QueryCtx, 'db'>,
  args: { serviceToken: string; weekStart: string }
) {
  requireAgentServiceToken(args.serviceToken);
  const dates = getWeekDates(args.weekStart);
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
    recipes: recipes.map(({ publicId, name, description, preparationTime, mealSuitabilityTags }) => ({
      publicId,
      name,
      description,
      preparationTime,
      mealSuitabilityTags
    })),
    busyness: WEEKDAYS.map((day, index) => {
      const start = startOfCalendarDay(dates[index] ?? '');
      const end = start + 24 * 60 * 60 * 1000;
      const exactDurationHours = events.reduce(
        (total, event) => total + Math.max(0, Math.min(event.end, end) - Math.max(event.start, start)) / 3_600_000,
        0
      );
      const weekdayDurationHours = events
        .filter((event) => weekdayForInstant(event.start) === day)
        .reduce((total, event) => total + Math.max(0, event.end - event.start) / 3_600_000, 0);
      return { day, level: busyLevel(exactDurationHours || weekdayDurationHours) };
    })
  };
}

export const planningContext = query({
  args: { serviceToken: v.string(), weekStart: v.string() },
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
