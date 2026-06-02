'use node';

import { JWT } from 'google-auth-library';
import { v } from 'convex/values';
import { action, internalAction, type ActionCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import { currentWeekRange } from './week';
import { normalizePrivateKey } from './credentials';
import { shouldSkipSync } from './syncPolicy';
import {
  toScheduleEvent,
  type CalendarConfig,
  type GoogleEvent,
  type MemberConfig,
  type ScheduleEventRow
} from './mapping';

// An unforced refresh reuses existing data if the last sync is this recent.
const FRESH_MS = 60_000; // 1 minute

type RefreshResult =
  | { skipped: true; count: null; lastSyncedAt: number | null }
  | { skipped: false; count: number; lastSyncedAt: number };

// Parse a JSON env var, naming the offending variable on malformed JSON so the
// failure points at the env var to fix rather than surfacing a bare SyntaxError.
function parseJsonEnv<T>(name: string, raw: string, fallback: string): T {
  try {
    return JSON.parse(raw || fallback) as T;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`${name} env var is not valid JSON: ${detail}`);
  }
}

function parseEnv() {
  const key = parseJsonEnv<{ client_email: string; private_key: string }>(
    'GOOGLE_SA_KEY',
    process.env.GOOGLE_SA_KEY ?? '',
    '{}'
  );
  const calendars = parseJsonEnv<CalendarConfig[]>(
    'SCHEDULE_CALENDARS',
    process.env.SCHEDULE_CALENDARS ?? '',
    '[]'
  );
  const members = parseJsonEnv<MemberConfig[]>(
    'SCHEDULE_MEMBERS',
    process.env.SCHEDULE_MEMBERS ?? '',
    '[]'
  );
  const tz = process.env.SCHEDULE_TZ ?? 'UTC';
  return { key, calendars, members, tz };
}

// The core sync, as a plain helper so both `run` (internal) and `refresh`
// (public) can call it directly — avoids a same-module action self-reference,
// which would otherwise create a circular type and the runAction round-trip.
async function performSync(
  ctx: ActionCtx
): Promise<{ count: number; lastSyncedAt: number }> {
  const { key, calendars, members, tz } = parseEnv();
  if (!key.client_email || !key.private_key) {
    throw new Error('GOOGLE_SA_KEY env var is missing or incomplete');
  }

  const privateKey = normalizePrivateKey(key.private_key);
  if (!privateKey.startsWith('-----BEGIN')) {
    throw new Error(
      'GOOGLE_SA_KEY private_key is not a valid PEM (check newline escaping in the env var)'
    );
  }

  const auth = new JWT({
    email: key.client_email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly']
  });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('Failed to obtain Google access token');

  const { timeMin, timeMax } = currentWeekRange(new Date(), tz);

  const rows: ScheduleEventRow[] = [];
  // Intentional: a single calendar failure aborts the whole sync rather than
  // producing a partial replace. In v1 this is the safest default; isolate
  // per-calendar if partial syncs become acceptable.
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
      rows.push(toScheduleEvent(event, calendar, members, tz));
    }
  }

  const syncedAt = Date.now();
  await ctx.runMutation(internal.schedule.queries.replaceAll, {
    events: rows,
    syncedAt
  });
  return { count: rows.length, lastSyncedAt: syncedAt };
}

// Internal: the core sync exposed for the CLI (`convex run schedule/sync:run`)
// and ops/testing — no auth, not client-callable.
export const run = internalAction({
  args: {},
  handler: async (ctx) => performSync(ctx)
});

// Public, Clerk-gated entry point the schedule app calls — on load and from the
// manual refresh button. An unforced call is skipped when the data is still
// fresh (see FRESH_MS); the refresh button passes `force: true` to bypass that.
export const refresh = action({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }): Promise<RefreshResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const lastSyncedAt = await ctx.runQuery(internal.schedule.queries.syncMeta);
    if (shouldSkipSync(lastSyncedAt, Date.now(), force ?? false, FRESH_MS)) {
      return { skipped: true as const, count: null, lastSyncedAt };
    }

    const result = await performSync(ctx);
    return { skipped: false as const, ...result };
  }
});
