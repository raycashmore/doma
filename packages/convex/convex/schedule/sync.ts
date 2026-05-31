'use node';

import { JWT } from 'google-auth-library';
import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { currentWeekRange } from './week';
import {
  toScheduleEvent,
  type CalendarConfig,
  type GoogleEvent,
  type MemberConfig,
  type ScheduleEventRow
} from './mapping';

function parseEnv() {
  const key = JSON.parse(process.env.GOOGLE_SA_KEY ?? '{}') as {
    client_email: string;
    private_key: string;
  };
  const calendars = JSON.parse(
    process.env.SCHEDULE_CALENDARS ?? '[]'
  ) as CalendarConfig[];
  const members = JSON.parse(process.env.SCHEDULE_MEMBERS ?? '[]') as MemberConfig[];
  const tz = process.env.SCHEDULE_TZ ?? 'UTC';
  return { key, calendars, members, tz };
}

// Internal: invoked by the cron. Pulls the current week from every configured
// calendar and full-replaces the scheduleEvents table.
export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const { key, calendars, members, tz } = parseEnv();

    const auth = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });
    const { token } = await auth.getAccessToken();
    if (!token) throw new Error('Failed to obtain Google access token');

    const { timeMin, timeMax } = currentWeekRange(new Date(), tz);

    const rows: ScheduleEventRow[] = [];
    for (const calendar of calendars) {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendar.calendarId
        )}/events`
      );
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('timeMin', timeMin);
      url.searchParams.set('timeMax', timeMax);
      url.searchParams.set('maxResults', '250');

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error(
          `Calendar fetch failed for ${calendar.calendarId}: ${res.status} ${await res.text()}`
        );
      }
      const data = (await res.json()) as { items?: GoogleEvent[] };
      for (const event of data.items ?? []) {
        if (event.status === 'cancelled') continue;
        rows.push(toScheduleEvent(event, calendar, members));
      }
    }

    await ctx.runMutation(internal.schedule.queries.replaceAll, { events: rows });
    return { count: rows.length };
  }
});
