import { internalMutation } from '../_generated/server';
import { morningBriefingKey } from '../briefing/morning';
import { calendarDateInTimeZone, shiftCalendarDate } from '../calendarDate';

const FIXTURE_MESSAGE_ID = 'noticeboard-fixture';
const FIXTURE_CALENDAR_ID = 'noticeboard-fixture';
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** A busy week for the Home widget: hours from now, then title and optional detail. */
const FIXTURE_EVENTS = [
  { inHours: 1.5, title: 'Pick up from dancing', detail: 'Dancing' },
  { inHours: 3, title: 'Bins out' },
  { inHours: 26, title: 'Swimming' },
  { inHours: 74, title: 'Swim meet' },
  { inHours: 100, title: 'Dentist' }
];

/**
 * Gives a local deployment a full noticeboard: today's briefing, an overdue school email
 * notice, last month's spending insight and a week of calendar events, all placeholder content.
 * Safe to rerun: rows that exist are kept, except the events, which move to start from now.
 * Run with `pnpm --filter @repo/convex seed:home`.
 */
export const seedNoticeboard = internalMutation({
  args: {},
  handler: async (ctx) => {
    const deployment = process.env.CONVEX_CLOUD_URL ?? '';
    if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(deployment)) {
      throw new Error(`Noticeboard fixtures are for a local deployment only, not ${deployment || 'this one'}.`);
    }

    const now = Date.now();
    const localDate = calendarDateInTimeZone(new Date(now), process.env.SCHEDULE_TZ ?? 'Australia/Sydney');
    const inserted: string[] = [];

    const briefingKey = morningBriefingKey({ briefingKind: 'morning', localDate });
    const briefing = await ctx.db
      .query('briefings')
      .withIndex('by_briefing_key', (q) => q.eq('briefingKey', briefingKey))
      .first();
    if (!briefing) {
      await ctx.db.insert('briefings', {
        briefingKey,
        briefingKind: 'morning',
        localDate,
        generationStatus: 'deterministic',
        generatedAt: now,
        message: 'Noticeboard fixture',
        sourceIds: [],
        briefing: {
          shouldSend: true,
          headline: 'Swimming bags, then a quiet afternoon',
          morning: [
            { text: 'swimming bag and towel', who: ['Child A'], sourceIds: [] },
            { text: 'library books back', who: ['Child B'], sourceIds: [] }
          ],
          afternoon: [],
          watchouts: [
            { text: 'Bins go out tonight', who: [], sourceIds: [] },
            { text: 'Rain after 4 pm', who: [], sourceIds: [] }
          ],
          sourceIdsIgnored: []
        }
      });
      inserted.push('briefing');
    }

    const monthKey = shiftCalendarDate(`${localDate.slice(0, 7)}-01`, -1).slice(0, 7);
    const insight = await ctx.db
      .query('spendingInsights')
      .withIndex('by_month_key', (q) => q.eq('monthKey', monthKey))
      .first();
    if (!insight) {
      await ctx.db.insert('spendingInsights', {
        monthKey,
        headline: 'This month, overall spending was a bit higher than the month before (up 9%).',
        observations: ['A few everyday categories moved up together: groceries, transport and entertainment.'],
        prediction: 'Next month should settle.',
        generatedAt: now,
        model: 'fixture'
      });
      inserted.push('spending insight');
    }

    const email = await ctx.db
      .query('capturedEmails')
      .withIndex('by_provider_message', (q) => q.eq('provider', 'resend').eq('providerMessageId', FIXTURE_MESSAGE_ID))
      .first();
    if (!email) {
      const receivedAt = now - 5 * DAY_MS;
      const capturedEmailId = await ctx.db.insert('capturedEmails', {
        provider: 'resend',
        providerMessageId: FIXTURE_MESSAGE_ID,
        messageFingerprint: FIXTURE_MESSAGE_ID,
        fromEmail: 'office@example.com',
        toEmails: ['home@example.com'],
        subject: 'Excursion permission',
        textBody: 'Noticeboard fixture',
        hasAttachments: false,
        attachmentMetadata: [],
        processingState: 'noticeCreated',
        receivedAt,
        capturedAt: receivedAt,
        updatedAt: receivedAt,
        rawBodyExpiresAt: now + 30 * DAY_MS,
        metadataExpiresAt: now + 90 * DAY_MS
      });
      await ctx.db.insert('emailNotices', {
        capturedEmailId,
        category: 'school',
        priority: 'high',
        title: 'Return the excursion permission slip',
        body: 'Sign the form and pay $18 through the school app before the excursion.',
        extractedFacts: [
          { label: 'From', value: 'School office' },
          { label: 'Cost', value: '$18' }
        ],
        telegramWorthy: false,
        obligation: {
          action: 'Sign and pay',
          dueOn: shiftCalendarDate(localDate, -2),
          dueDateConfidence: 'high',
          dueDateEvidence: 'Noticeboard fixture'
        },
        createdAt: receivedAt,
        updatedAt: receivedAt
      });
      inserted.push('email notice');
    }

    const staleEvents = (await ctx.db.query('scheduleEvents').collect()).filter(
      (event) => event.calendarId === FIXTURE_CALENDAR_ID
    );
    await Promise.all(staleEvents.map((event) => ctx.db.delete(event._id)));
    for (const [index, event] of FIXTURE_EVENTS.entries()) {
      const start = now + event.inHours * HOUR_MS;
      await ctx.db.insert('scheduleEvents', {
        googleEventId: `noticeboard-fixture-${index}`,
        calendarId: FIXTURE_CALENDAR_ID,
        start,
        end: start + HOUR_MS,
        allDay: false,
        title: event.title,
        ...(event.detail ? { description: event.detail } : {}),
        who: [],
        recurring: false,
        htmlLink: 'https://calendar.google.com/'
      });
    }
    inserted.push('calendar events');

    return { localDate, inserted };
  }
});
