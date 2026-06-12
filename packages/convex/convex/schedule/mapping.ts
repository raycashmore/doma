import { zonedDateStartMs } from './week';

export type CalendarConfig = {
  calendarId: string;
  // A member id for a per-person calendar, or the literal "shared".
  who: string;
  kind?: 'dailyRequirements';
};

export type MemberConfig = {
  id: string;
  label?: string;
  initials?: string;
  tokens: string[];
};

// Minimal shape of the fields we read from a Google Calendar event resource.
export type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
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
  kind?: 'dailyRequirements';
  description?: string;
  location?: string;
  who: string[];
  recurring: boolean;
  htmlLink: string;
};

function matchesToken(title: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(title);
}

function decodeHtmlEntity(entity: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  };
  if (entity.startsWith('#x')) {
    const codePoint = Number.parseInt(entity.slice(2), 16);
    return Number.isNaN(codePoint) ? `&${entity};` : String.fromCodePoint(codePoint);
  }
  if (entity.startsWith('#')) {
    const codePoint = Number.parseInt(entity.slice(1), 10);
    return Number.isNaN(codePoint) ? `&${entity};` : String.fromCodePoint(codePoint);
  }
  return namedEntities[entity] ?? `&${entity};`;
}

export function sanitizeRequirementDescription(description: string): string {
  return description
    .replace(/\r\n?/g, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>\s*<\s*p[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => decodeHtmlEntity(entity.toLowerCase()))
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

// Per-person calendar -> that member. Shared calendar -> members named in the
// title, or the first configured member when none are named.
export function deriveWho(title: string, calendar: CalendarConfig, members: MemberConfig[]): string[] {
  if (calendar.who !== 'shared') return [calendar.who];
  const matched = members.filter((m) => m.tokens.some((token) => matchesToken(title, token)));
  return matched.length > 0 ? matched.map((m) => m.id) : members.slice(0, 1).map((m) => m.id);
}

export function toScheduleEvent(
  ev: GoogleEvent,
  calendar: CalendarConfig,
  members: MemberConfig[],
  tz: string
): ScheduleEventRow {
  const title = ev.summary ?? '(no title)';
  const allDay = !ev.start.dateTime;
  const startRaw = allDay ? ev.start.date : ev.start.dateTime;
  const endRaw = allDay ? ev.end.date : ev.end.dateTime;
  if (!startRaw || !endRaw) {
    throw new Error(`Event ${ev.id}: missing start/end timestamp`);
  }
  // Timed events carry an explicit offset (or Z) in `dateTime`, so Date.parse is
  // zone-correct. All-day events carry a bare date and must be anchored to local
  // midnight in `tz`.
  const start = allDay ? zonedDateStartMs(startRaw, tz) : Date.parse(startRaw);
  const end = allDay ? zonedDateStartMs(endRaw, tz) : Date.parse(endRaw);
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
  if (calendar.kind === 'dailyRequirements') {
    row.kind = 'dailyRequirements';
    const description = ev.description ? sanitizeRequirementDescription(ev.description) : '';
    if (description) row.description = description;
  }
  if (ev.location) row.location = ev.location;
  return row;
}
