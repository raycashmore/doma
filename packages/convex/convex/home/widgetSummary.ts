import { v } from 'convex/values';

import type { Doc } from '../_generated/dataModel';
import { query, type QueryCtx } from '../_generated/server';
import { sourceIdForEvent } from '../briefing/morning';
import { calendarDateInTimeZone } from '../calendarDate';
import { readGroceriesListForUser } from '../lists/groceries';
import { readListItems } from '../lists/items';
import { requireSignedIn } from '../signedIn';
import { type DueState, dueStateFor, dueStateRank, isActiveEmailNotice } from './boardRules';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
/** Daily requirements only ever show as today's Next, so the widget needs them for its timeline's day ahead. */
const REQUIREMENTS_SPAN_MS = 2 * DAY_MS;
/** More events than any widget size shows, so rows still fill the tile after earlier events finish. */
const THIS_WEEK_LIMIT = 8;

type WidgetSummaryOptions = { now: Date; timeZone: string };

/**
 * The Home widget's "Board" data: this week's events in start order, the coming daily requirements,
 * the Shopping list's count and the top note. The widget decides which event is Next and what This
 * week shows (`DomaHomeWidgetBoard` in the iOS app), at each moment of its own timeline, so this
 * read only bounds the time window. Notes and dated email notices compete for the note tile by how
 * soon they are due.
 */
export async function readHomeWidgetSummary(ctx: Pick<QueryCtx, 'auth' | 'db'>, options: WidgetSummaryOptions) {
  const identity = await requireSignedIn(ctx);
  const nowMs = options.now.getTime();
  const localDate = calendarDateInTimeZone(options.now, options.timeZone);

  const [events, manualNotes, emailNotices, boardArchives, list] = await Promise.all([
    ctx.db
      .query('scheduleEvents')
      .withIndex('by_start', (q) => q.lt('start', nowMs + WEEK_MS))
      .collect(),
    ctx.db.query('manualNotes').collect(),
    ctx.db.query('emailNotices').collect(),
    ctx.db.query('boardArchives').collect(),
    readGroceriesListForUser(ctx, identity.subject)
  ]);

  const current = events
    .filter((event) => event.end > nowMs)
    .sort((left, right) => left.start - right.start || left.googleEventId.localeCompare(right.googleEventId));
  const upcoming = current
    .filter((event) => event.kind !== 'dailyRequirements' && event.start < nowMs + WEEK_MS)
    .map(toWidgetEvent);
  const requirements = current
    .filter(
      (event) => event.kind === 'dailyRequirements' && !event.allDay && event.start < nowMs + REQUIREMENTS_SPAN_MS
    )
    .map(toWidgetEvent);

  const archived = new Set(boardArchives.map((archive) => archive.occurrenceId));
  const noteCandidates: NoteCandidate[] = [
    ...manualNotes
      .filter((note) => !archived.has(`manualNote:${note._id}`))
      .map((note) => ({
        kind: 'manualNote' as const,
        id: note._id,
        title: note.title,
        dueDate: note.dueDate,
        dueState: dueStateFor(note.dueDate, localDate),
        changedAt: note.updatedAt
      })),
    ...emailNotices
      .filter((notice) => isActiveEmailNotice(notice, nowMs) && !archived.has(`emailNotice:${notice._id}`))
      .flatMap((notice) => {
        const dueDate = notice.obligation?.dueOn;
        if (!dueDate) return [];
        return [
          {
            kind: 'emailNotice' as const,
            id: notice._id,
            title: notice.title,
            dueDate,
            dueState: dueStateFor(dueDate, localDate),
            changedAt: notice.createdAt
          }
        ];
      })
  ];
  const topNote = noteCandidates.sort(compareNotes)[0];

  return {
    localDate,
    thisWeek: { events: upcoming.slice(0, THIS_WEEK_LIMIT) },
    requirements,
    list: list
      ? {
          publicId: list.publicId,
          name: list.name,
          activeCount: (await readListItems(ctx, list._id)).filter((item) => item.completedAt === undefined).length
        }
      : null,
    note: topNote
      ? {
          kind: topNote.kind,
          id: topNote.id,
          title: topNote.title,
          ...(topNote.dueDate ? { dueDate: topNote.dueDate } : {}),
          dueState: topNote.dueState
        }
      : null
  };
}

function toWidgetEvent(event: Doc<'scheduleEvents'>) {
  return {
    id: sourceIdForEvent(event),
    title: event.title,
    ...(event.description?.trim() ? { detail: event.description.trim().split('\n')[0]!.trim() } : {}),
    start: event.start,
    end: event.end,
    allDay: event.allDay
  };
}

type NoteCandidate = {
  kind: 'manualNote' | 'emailNotice';
  id: string;
  title: string;
  dueDate: string | undefined;
  dueState: DueState;
  changedAt: number;
};

/** Soonest due first; on the same day a person's note beats a forwarded email; then newest. */
function compareNotes(left: NoteCandidate, right: NoteCandidate) {
  return (
    dueStateRank[left.dueState] - dueStateRank[right.dueState] ||
    (left.dueDate ?? '').localeCompare(right.dueDate ?? '') ||
    Number(left.kind === 'emailNotice') - Number(right.kind === 'emailNotice') ||
    right.changedAt - left.changedAt
  );
}

const widgetEvent = v.object({
  id: v.string(),
  title: v.string(),
  detail: v.optional(v.string()),
  start: v.number(),
  end: v.number(),
  allDay: v.boolean()
});

const dueState = v.union(v.literal('overdue'), v.literal('dueToday'), v.literal('upcoming'), v.literal('none'));

export const homeWidgetSummary = query({
  // The handler reads the clock, so callers pass a changing token to avoid a result cached for an earlier time.
  args: { refreshToken: v.number() },
  returns: v.object({
    localDate: v.string(),
    thisWeek: v.object({ events: v.array(widgetEvent) }),
    requirements: v.array(widgetEvent),
    list: v.union(v.object({ publicId: v.string(), name: v.string(), activeCount: v.number() }), v.null()),
    note: v.union(
      v.object({
        kind: v.union(v.literal('manualNote'), v.literal('emailNotice')),
        id: v.string(),
        title: v.string(),
        dueDate: v.optional(v.string()),
        dueState
      }),
      v.null()
    )
  }),
  handler: (ctx) =>
    readHomeWidgetSummary(ctx, { now: new Date(), timeZone: process.env.SCHEDULE_TZ ?? 'Australia/Sydney' })
});
