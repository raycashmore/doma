import type { CalendarConfig, ScheduleEventRow } from '../schedule/mapping';
import type { ScheduleDisplayMember } from '../schedule/config';
import { zonedDateStartMs } from '../schedule/week';

export type BriefingKind = 'morning';

export type BriefingItem = {
  text: string;
  kind: 'routine' | 'important' | 'timing' | 'uncertain';
  tags: ('wear' | 'bring' | 'prepare' | 'remember' | 'coordinate' | 'leaveEarlier')[];
  sourceIds: string[];
};

export type BriefingLine = {
  text: string;
  who: string[];
  sourceIds: string[];
};

export type MorningBriefing = {
  shouldSend: boolean;
  headline: string;
  morning: BriefingLine[];
  afternoon: BriefingLine[];
  watchouts: BriefingLine[];
  sourceIdsIgnored: string[];
};

export type MorningBriefingEvent = ScheduleEventRow;

export type DeterministicMorningBriefing = {
  briefingKind: BriefingKind;
  localDate: string;
  generationStatus: 'ai' | 'deterministic' | 'fallback' | 'setupProblem';
  briefing: MorningBriefing;
  message: string;
  sourceIds: string[];
};

export function morningBriefingKey({ briefingKind, localDate }: { briefingKind: BriefingKind; localDate: string }) {
  return `${briefingKind}:${localDate}`;
}

export function sourceIdForEvent(event: Pick<MorningBriefingEvent, 'calendarId' | 'googleEventId' | 'start'>) {
  return `${event.calendarId}:${event.googleEventId}:${event.start}`;
}

function addUtcDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function localDateRangeMs({ localDate, timeZone }: { localDate: string; timeZone: string }) {
  return {
    start: zonedDateStartMs(localDate, timeZone),
    end: zonedDateStartMs(addUtcDays(localDate, 1), timeZone)
  };
}

export function collectMorningBriefingEvents({
  events,
  localDate,
  timeZone
}: {
  events: MorningBriefingEvent[];
  localDate: string;
  timeZone: string;
}) {
  const range = localDateRangeMs({ localDate, timeZone });
  return events
    .filter((event) => event.start < range.end && event.end > range.start)
    .sort((a, b) => a.start - b.start || a.googleEventId.localeCompare(b.googleEventId));
}

function emptyBriefing(headline: string): MorningBriefing {
  return {
    shouldSend: true,
    headline,
    morning: [],
    afternoon: [],
    watchouts: [],
    sourceIdsIgnored: []
  };
}

export function fallbackMorningBriefingHeadline(dailyRequirementCount: number) {
  return dailyRequirementCount > 0 ? "Today's requirements" : 'No daily requirements found.';
}

export function formatMorningBriefing(briefing: MorningBriefing, members: ScheduleDisplayMember[]) {
  if (!briefing.shouldSend) return '';

  const lines = ['Today:', sanitizeBriefingText(briefing.headline).replace(/^Today:\s*/i, '')];

  appendBlock(lines, 'This morning:', briefing.morning, members);
  appendBlock(lines, 'This afternoon:', briefing.afternoon, members);
  appendWatchouts(lines, briefing.watchouts);

  return lines.join('\n');
}

function appendBlock(lines: string[], heading: string, blockLines: BriefingLine[], members: ScheduleDisplayMember[]) {
  if (blockLines.length === 0) return;

  const order = new Map(members.map((member, index) => [member.id, index]));
  const labels = new Map(members.map((member) => [member.id, member.label]));
  const sorted = [...blockLines].sort((a, b) => lineOrder(a, order) - lineOrder(b, order));

  lines.push('', heading, ...sorted.map((line) => renderPersonLine(line, labels)));
}

function lineOrder(line: BriefingLine, order: Map<string, number>) {
  const indices = line.who.map((id) => order.get(id) ?? Number.POSITIVE_INFINITY);
  return indices.length > 0 ? Math.min(...indices) : Number.POSITIVE_INFINITY;
}

function renderPersonLine(line: BriefingLine, labels: Map<string, string>) {
  const who = sanitizeBriefingText(line.who.map((id) => labels.get(id) ?? id).join(', '));
  const text = sanitizeBriefingText(line.text);
  return who ? `- ${who}: ${text}` : `- ${text}`;
}

function appendWatchouts(lines: string[], watchouts: BriefingLine[]) {
  if (watchouts.length === 0) return;

  lines.push('', 'Watchouts', ...watchouts.map((line) => `- ${sanitizeBriefingText(line.text)}`));
}

function sanitizeBriefingText(text: string) {
  return text
    .replace(/\bfor member[A-Z]\b/g, '')
    .replace(/\bmember[A-Z]\s+handoff\b/gi, 'handoff')
    .replace(/\bmember[A-Z]\s+and\s+member[A-Z]:\s*/g, '')
    .replace(/\bmember[A-Z]:\s*/g, '')
    .replace(/\bmember[A-Z]\s+and\s+member[A-Z]\b/g, 'the children')
    .replace(/\bmember[A-Z]\b/g, 'someone')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isMorningEvent(event: MorningBriefingEvent, timeZone: string) {
  if (event.allDay) return true;
  const hour = Number(
    new Intl.DateTimeFormat('en-AU', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(event.start))
  );
  return hour < 12;
}

function eventDetail(event: MorningBriefingEvent) {
  return event.description?.trim() || event.title.trim();
}

export function buildPersonLines(events: MorningBriefingEvent[]): BriefingLine[] {
  const groups = new Map<string, BriefingLine>();
  for (const event of events) {
    const key = event.who.join('|');
    const sourceId = sourceIdForEvent(event);
    const detail = eventDetail(event);
    const existing = groups.get(key);
    if (existing) {
      existing.text = `${existing.text}; ${detail}`;
      existing.sourceIds.push(sourceId);
    } else {
      groups.set(key, { text: detail, who: event.who, sourceIds: [sourceId] });
    }
  }
  return [...groups.values()];
}

export function createDeterministicMorningBriefing({
  localDate,
  timeZone,
  events,
  calendarConfigs,
  members
}: {
  localDate: string;
  timeZone: string;
  calendarConfigs: CalendarConfig[];
  events: MorningBriefingEvent[];
  members: ScheduleDisplayMember[];
}): DeterministicMorningBriefing {
  if (!calendarConfigs.some((calendar) => calendar.kind === 'dailyRequirements')) {
    const briefing = emptyBriefing(
      "Daily requirements calendar is not configured yet, so I can't check day-specific requirements."
    );
    return {
      briefingKind: 'morning',
      localDate,
      generationStatus: 'setupProblem',
      sourceIds: [],
      briefing,
      message: formatMorningBriefing(briefing, members)
    };
  }

  const localEvents = collectMorningBriefingEvents({ events, localDate, timeZone });
  const dailyRequirements = localEvents.filter((event) => event.kind === 'dailyRequirements');

  if (dailyRequirements.length > 0) {
    const morning = buildPersonLines(dailyRequirements.filter((event) => isMorningEvent(event, timeZone)));
    const afternoon = buildPersonLines(dailyRequirements.filter((event) => !isMorningEvent(event, timeZone)));
    const briefing: MorningBriefing = {
      ...emptyBriefing("Today's requirements"),
      morning,
      afternoon
    };
    return {
      briefingKind: 'morning',
      localDate,
      generationStatus: 'deterministic',
      sourceIds: [...morning, ...afternoon].flatMap((line) => line.sourceIds),
      briefing,
      message: formatMorningBriefing(briefing, members)
    };
  }

  const briefing = emptyBriefing('Normal day. No special requirements found.');
  return {
    briefingKind: 'morning',
    localDate,
    generationStatus: 'deterministic',
    sourceIds: [],
    briefing,
    message: formatMorningBriefing(briefing, members)
  };
}

export function createMorningBriefingFallback({ events }: { events: MorningBriefingEvent[] }) {
  const dailyRequirements = events.filter((event) => event.kind === 'dailyRequirements');
  const routineItems = requirementRoutineItems(dailyRequirements);
  const briefing: MorningBriefing = {
    ...emptyBriefing(fallbackMorningBriefingHeadline(dailyRequirements.length)),
    routineItems
  };
  const message = formatMorningBriefing(briefing);

  return {
    briefing,
    message,
    sourceIds: routineItems.flatMap((item) => item.sourceIds)
  };
}

export function formatMorningBriefingFallback({ events }: { events: MorningBriefingEvent[] }) {
  const { message, sourceIds } = createMorningBriefingFallback({ events });
  return {
    message,
    sourceIds
  };
}
