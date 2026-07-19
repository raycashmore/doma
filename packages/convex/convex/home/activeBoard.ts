import { v } from 'convex/values';

import { query, type QueryCtx } from '../_generated/server';
import { localDateRangeMs, morningBriefingKey, sourceIdForEvent } from '../briefing/morning';
import { calendarDateInTimeZone, weekFactsForCalendarDate } from '../calendarDate';
import { pickLatestSpendingInsight } from '../insights/latest';

type ActiveBoardQueryCtx = Pick<QueryCtx, 'auth' | 'db'>;

type ActiveBoardOptions = {
  now: Date;
  timeZone: string;
};

export async function readActiveBoard(ctx: ActiveBoardQueryCtx, options: ActiveBoardOptions) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const localDate = calendarDateInTimeZone(options.now, options.timeZone);
  const { weekStart, weekday } = weekFactsForCalendarDate(localDate);
  const [{ start: dayStart, end: dayEnd }, briefing, events, mealPlan, emailNotices, spendingInsights] =
    await Promise.all([
      Promise.resolve(localDateRangeMs({ localDate, timeZone: options.timeZone })),
      ctx.db
        .query('briefings')
        .withIndex('by_briefing_key', (q) =>
          q.eq('briefingKey', morningBriefingKey({ briefingKind: 'morning', localDate }))
        )
        .unique(),
      ctx.db.query('scheduleEvents').withIndex('by_start').collect(),
      ctx.db
        .query('weeklyMealPlans')
        .withIndex('by_week_start', (q) => q.eq('weekStart', weekStart))
        .unique(),
      ctx.db.query('emailNotices').collect(),
      ctx.db.query('spendingInsights').collect()
    ]);

  const eventBySourceId = new Map(events.map((event) => [sourceIdForEvent(event), event]));
  const isCurrentBriefingLine = (line: { sourceIds: string[] }) =>
    line.sourceIds.length === 0 || line.sourceIds.every((sourceId) => eventBySourceId.has(sourceId));
  const isLaterToday = (event: (typeof events)[number]) =>
    event.start < dayEnd && event.end > dayStart && event.end > options.now.getTime();
  const fallbackLaterEvents = events.filter((event) => isLaterToday(event) && event.kind !== 'dailyRequirements');
  const afternoonLines = briefing?.briefing.afternoon.filter(isCurrentBriefingLine) ?? [];
  const curatedLaterToday = afternoonLines.flatMap((line) => {
    const linkedEvents = line.sourceIds.flatMap((sourceId) => {
      const event = eventBySourceId.get(sourceId);
      return event && isLaterToday(event) ? [event] : [];
    });
    if (linkedEvents.length === 0) return [];

    return [
      {
        id: line.sourceIds.join('|'),
        title: line.text,
        start: Math.min(...linkedEvents.map((event) => event.start)),
        end: Math.max(...linkedEvents.map((event) => event.end)),
        allDay: linkedEvents.every((event) => event.allDay),
        who: line.who,
        destination: '/schedule'
      }
    ];
  });
  const laterToday =
    curatedLaterToday.length > 0
      ? curatedLaterToday
      : fallbackLaterEvents
          .sort((left, right) => left.start - right.start || left.googleEventId.localeCompare(right.googleEventId))
          .map((event) => ({
            id: sourceIdForEvent(event),
            title: event.title,
            ...(event.description?.trim() ? { detail: event.description.trim() } : {}),
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            who: event.who,
            destination: '/schedule'
          }));

  const briefingStatus = !briefing
    ? ('missing' as const)
    : briefing.briefing.shouldSend
      ? ('available' as const)
      : ('empty' as const);

  const assignments = mealPlan?.assignments.filter((assignment) => assignment.day === weekday) ?? [];
  const recipeNames = new Map<string, string>();
  await Promise.all(
    assignments.map(async (assignment) => {
      const recipe = await ctx.db
        .query('recipes')
        .withIndex('by_public_id', (q) => q.eq('publicId', assignment.recipePublicId))
        .unique();
      if (recipe) recipeNames.set(assignment.recipePublicId, recipe.name);
    })
  );

  const mealName = (meal: 'schoolLunch' | 'dinner') => {
    const assignment = assignments.find((candidate) => candidate.meal === meal);
    return (assignment && recipeNames.get(assignment.recipePublicId)) || 'Not planned';
  };

  const emailNoticeItems = emailNotices
    .filter(
      (notice) =>
        notice.archivedAt === undefined &&
        notice.supersededAt === undefined &&
        (notice.expiresAt === undefined || notice.expiresAt > options.now.getTime())
    )
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((notice) => ({
      kind: 'sourceNotice' as const,
      id: `emailNotice:${notice._id}`,
      sourceKind: 'forwardedEmail' as const,
      sourceApp: 'home' as const,
      display:
        notice.priority === 'high'
          ? ('wide' as const)
          : notice.priority === 'low'
            ? ('compact' as const)
            : ('standard' as const),
      priority: notice.priority,
      title: notice.title,
      detail: notice.body,
      facts: notice.extractedFacts,
      occurredAt: notice.createdAt,
      destination: `/notices/${notice._id}`
    }));
  const currentMonthKey = localDate.slice(0, 7);
  const latestSpendingInsight = pickLatestSpendingInsight(
    spendingInsights.filter((insight) => insight.monthKey <= currentMonthKey)
  );
  const spendingInsightItems = latestSpendingInsight
    ? [
        {
          kind: 'sourceNotice' as const,
          id: `spendingInsight:${latestSpendingInsight.monthKey}`,
          sourceKind: 'monthlySpendingInsight' as const,
          sourceApp: 'budget' as const,
          display: 'standard' as const,
          priority: 'medium' as const,
          title: latestSpendingInsight.headline,
          detail: latestSpendingInsight.observations[0] ?? latestSpendingInsight.prediction,
          occurredAt: latestSpendingInsight.generatedAt,
          period: latestSpendingInsight.monthKey,
          destination: '/budget'
        }
      ]
    : [];

  return {
    localDate,
    timeZone: options.timeZone,
    items: [
      {
        kind: 'today' as const,
        id: `today:${localDate}`,
        destination: '/schedule',
        briefingStatus,
        headline: briefing?.briefing.headline || 'Today',
        generatedAt: briefing?.generatedAt ?? null,
        morning:
          briefingStatus === 'available' && briefing ? briefing.briefing.morning.filter(isCurrentBriefingLine) : [],
        laterToday,
        watchouts:
          briefingStatus === 'available' && briefing ? briefing.briefing.watchouts.filter(isCurrentBriefingLine) : []
      },
      {
        kind: 'meals' as const,
        id: `meals:${localDate}`,
        destination: '/meals',
        schoolLunch: mealName('schoolLunch'),
        dinner: mealName('dinner')
      },
      ...emailNoticeItems,
      ...spendingInsightItems
    ]
  };
}

export const activeBoard = query({
  args: { refreshToken: v.number() },
  handler: async (ctx) =>
    readActiveBoard(ctx, {
      now: new Date(),
      timeZone: process.env.SCHEDULE_TZ ?? 'Australia/Sydney'
    })
});
