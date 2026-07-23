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

const ownerTagPattern = /@doma-owner\(([^\r\n)]*)\)/gi;
const titleOwnerPrefixPattern = /^\s*(.+?)(?:\s*:\s*|\s+-\s+)(?=\S)/;

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

export function sanitizeEventDescription(description: string): string {
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

function resolveMemberReference(reference: string, members: MemberConfig[]): string | undefined {
  const normalizedReference = reference.trim().toLocaleLowerCase();
  const matches = members.filter(
    (member) =>
      member.id.toLocaleLowerCase() === normalizedReference ||
      member.tokens.some((token) => token.trim().toLocaleLowerCase() === normalizedReference)
  );
  return matches.length === 1 ? matches[0]?.id : undefined;
}

// Per-person calendars are authoritative. Shared-calendar events use an
// unambiguous structured title prefix, then fall back to an explicit owner tag.
export function deriveWho(
  description: string | undefined,
  calendar: CalendarConfig,
  members: MemberConfig[],
  title = ''
): string[] {
  if (calendar.who !== 'shared') return [calendar.who];

  const titleReference = titleOwnerPrefixPattern.exec(title)?.[1];
  if (titleReference) {
    const memberId = resolveMemberReference(titleReference, members);
    if (memberId) return [memberId];
  }

  const matches = [...(description ?? '').matchAll(ownerTagPattern)];
  const ownerTag = matches[0];
  const ownerTagContents = ownerTag?.[1];
  if (matches.length !== 1 || ownerTagContents === undefined) return [];

  const ownerIds = ownerTagContents
    .split(',')
    .map((reference) => resolveMemberReference(reference, members))
    .filter((id): id is string => Boolean(id));
  const ownerReferences = ownerTagContents.split(',').map((reference) => reference.trim());

  if (
    ownerIds.length === 0 ||
    ownerIds.length !== ownerReferences.length ||
    new Set(ownerIds).size !== ownerIds.length ||
    ownerReferences.some((reference) => !reference)
  ) {
    return [];
  }

  return ownerIds;
}

function withoutOwnerTags(description: string) {
  return sanitizeEventDescription(description.replace(ownerTagPattern, ''));
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
  const description = ev.description ? sanitizeEventDescription(ev.description) : '';
  const row: ScheduleEventRow = {
    googleEventId: ev.id,
    calendarId: calendar.calendarId,
    start,
    end,
    allDay,
    title,
    who: deriveWho(description, calendar, members, title),
    recurring: Boolean(ev.recurringEventId),
    htmlLink: ev.htmlLink
  };
  if (calendar.kind === 'dailyRequirements') {
    row.kind = 'dailyRequirements';
  }
  const visibleDescription = description ? withoutOwnerTags(description) : '';
  if (visibleDescription) row.description = visibleDescription;
  if (ev.location) row.location = ev.location;
  return row;
}
