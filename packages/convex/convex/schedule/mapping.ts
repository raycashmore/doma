export type CalendarConfig = {
  calendarId: string;
  // A member id for a per-person calendar, or the literal "shared".
  who: string;
};

export type MemberConfig = {
  id: string;
  tokens: string[];
};

// Minimal shape of the fields we read from a Google Calendar event resource.
export type GoogleEvent = {
  id: string;
  summary?: string;
  location?: string;
  htmlLink: string;
  status?: string;
  recurringEventId?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

export type ScheduleEventRow = {
  googleEventId: string;
  calendarId: string;
  start: number;
  end: number;
  allDay: boolean;
  title: string;
  location?: string;
  who: string[];
  recurring: boolean;
  htmlLink: string;
};

function matchesToken(title: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(title);
}

// Per-person calendar → that member. Shared calendar → members named in the
// title, or the whole family when none are named.
export function deriveWho(
  title: string,
  calendar: CalendarConfig,
  members: MemberConfig[]
): string[] {
  if (calendar.who !== 'shared') return [calendar.who];
  const matched = members.filter((m) =>
    m.tokens.some((token) => matchesToken(title, token))
  );
  return matched.length > 0 ? matched.map((m) => m.id) : members.map((m) => m.id);
}

export function toScheduleEvent(
  ev: GoogleEvent,
  calendar: CalendarConfig,
  members: MemberConfig[]
): ScheduleEventRow {
  const title = ev.summary ?? '(no title)';
  const allDay = !ev.start.dateTime;
  const startRaw = allDay ? ev.start.date : ev.start.dateTime;
  const endRaw = allDay ? ev.end.date : ev.end.dateTime;
  if (!startRaw || !endRaw) {
    throw new Error(`Event ${ev.id}: missing start/end timestamp`);
  }
  const start = Date.parse(startRaw);
  const end = Date.parse(endRaw);
  const row: ScheduleEventRow = {
    googleEventId: ev.id,
    calendarId: calendar.calendarId,
    start,
    end,
    allDay,
    title,
    who: deriveWho(title, calendar, members),
    recurring: Boolean(ev.recurringEventId),
    htmlLink: ev.htmlLink
  };
  if (ev.location) row.location = ev.location;
  return row;
}
