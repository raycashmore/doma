import type { ScheduleDisplayMember } from '../schedule/config';
import type { CalendarConfig, ScheduleEventRow } from '../schedule/mapping';
import { zonedDateStartMs } from '../schedule/week';
import type { MorningBriefingWeatherContext, WeatherReadinessBlock } from './weather';

export type BriefingKind = 'morning';

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

export type BriefingDeliverySlot = 'morning' | 'afternoon';

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

  const lines = ['Today:', normalizeBriefingText(briefing.headline).replace(/^Today:\s*/i, '')];

  appendBlock(lines, 'This morning:', briefing.morning, members);
  appendBlock(lines, 'This afternoon:', briefing.afternoon, members);
  appendWatchouts(lines, briefing.watchouts);

  return lines.join('\n');
}

export function formatBriefingDeliveryMessage(
  briefing: MorningBriefing,
  members: ScheduleDisplayMember[],
  {
    slot,
    weather
  }: {
    slot: BriefingDeliverySlot;
    weather?: MorningBriefingWeatherContext;
  }
) {
  if (!briefing.shouldSend) return '';

  const lines: string[] = [];
  if (slot === 'morning') {
    lines.push(normalizeBriefingText(briefing.headline).replace(/^Today:\s*/i, ''));
    appendBlock(lines, 'This morning:', briefing.morning, members);
    appendWatchouts(lines, briefing.watchouts);
  } else {
    appendBlock(lines, 'This afternoon:', briefing.afternoon, members);
    if (briefing.afternoon.length > 0) {
      appendWeatherReadiness(lines, weather?.afternoon);
    }
  }

  return lines.join('\n').trim();
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
  const personLabels = line.who.map((id) => labels.get(id) ?? id);
  const who = normalizeBriefingText(personLabels.join(', '));
  const text = normalizePersonPrefixedBriefingText(line.text, personLabels);
  return who ? `- ${who}: ${text}` : `- ${text}`;
}

function appendWatchouts(lines: string[], watchouts: BriefingLine[]) {
  if (watchouts.length === 0) return;

  lines.push('', 'Watchouts', ...watchouts.map((line) => `- ${normalizeBriefingText(line.text)}`));
}

function appendWeatherReadiness(lines: string[], afternoon: WeatherReadinessBlock | undefined) {
  if (!afternoon || afternoon.readiness.length === 0) return;

  const readinessLines = afternoon.readiness.map((hint) => `- ${weatherReadinessText(hint)}`);
  lines.push('', 'Weather:', ...readinessLines);
}

function weatherReadinessText(hint: string) {
  switch (hint) {
    case 'warm layer':
      return 'Warm layer may help this afternoon.';
    case 'rain layer':
      return 'Rain layer may help this afternoon.';
    case 'heat plan':
      return 'Heat plan may help this afternoon.';
    case 'wind-aware pickup':
      return 'Plan for windy pickup conditions this afternoon.';
    case 'sun protection':
      return 'Sun protection may help this afternoon.';
    case 'allergy humidity':
      return 'High humidity may matter for allergy control this afternoon.';
    default:
      return `${normalizeBriefingText(hint)} may help this afternoon.`;
  }
}

function normalizeBriefingText(text: string) {
  return text
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripKnownPersonPrefix(text: string, personLabels: string[]) {
  let cleaned = text;
  for (const label of personLabels) {
    const escapedLabel = escapeRegExp(label);
    cleaned = cleaned
      .replace(new RegExp(`^\\s*${escapedLabel}\\s+(?:has|have)\\s+([a-z])`, 'i'), (_, first: string) =>
        first.toUpperCase()
      )
      .replace(new RegExp(`^\\s*${escapedLabel}\\s+(?:has|have)\\s+`, 'i'), '')
      .replace(new RegExp(`^\\s*${escapedLabel}:\\s*`, 'i'), '');
  }

  return cleaned;
}

function normalizePersonPrefixedBriefingText(text: string, personLabels: string[] = []) {
  return normalizeBriefingText(stripKnownPersonPrefix(text, personLabels));
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

export function isPlainMorningBriefing(briefing: MorningBriefing) {
  return (
    isPlainBriefingText(briefing.headline) &&
    briefing.morning.every(isPlainBriefingLine) &&
    briefing.afternoon.every(isPlainBriefingLine) &&
    briefing.watchouts.every(isPlainBriefingLine)
  );
}

export function isValidMorningBriefingForMembers(briefing: MorningBriefing, members: ScheduleDisplayMember[]) {
  const knownMemberIds = new Set(members.map((member) => member.id));
  return (
    isPlainMorningBriefing(briefing) &&
    briefing.morning.every((line) => lineHasKnownOwners(line, knownMemberIds)) &&
    briefing.afternoon.every((line) => lineHasKnownOwners(line, knownMemberIds)) &&
    briefing.watchouts.every((line) => lineHasKnownOwners(line, knownMemberIds))
  );
}

export function isPlainBriefingText(text: string) {
  return !text.includes('<') && !text.includes('>') && !containsHtmlEntity(text);
}

function isPlainBriefingLine(line: BriefingLine) {
  return isPlainBriefingText(line.text);
}

function lineHasKnownOwners(line: BriefingLine, knownMemberIds: Set<string>) {
  return line.who.every((id) => knownMemberIds.has(id));
}

function containsHtmlEntity(text: string) {
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const ampersandIndex = text.indexOf('&', searchFrom);
    if (ampersandIndex === -1) return false;
    const semicolonIndex = text.indexOf(';', ampersandIndex + 1);
    if (semicolonIndex === -1) return false;
    const entity = text.slice(ampersandIndex + 1, semicolonIndex).toLowerCase();
    if (isNumericHtmlEntity(entity) || isNamedHtmlEntityShape(entity)) return true;
    searchFrom = ampersandIndex + 1;
  }
  return false;
}

function isNumericHtmlEntity(entity: string) {
  if (!entity.startsWith('#')) return false;
  const digits = entity.startsWith('#x') ? entity.slice(2) : entity.slice(1);
  if (!digits) return false;
  return everyCharacter(digits, entity.startsWith('#x') ? isAsciiHexDigit : isAsciiDigit);
}

function isNamedHtmlEntityShape(entity: string) {
  if (!isAsciiLetter(entity[0])) return false;
  return everyCharacter(entity, isAsciiLetterOrDigit);
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
      groups.set(key, { text: detail, who: [...event.who], sourceIds: [sourceId] });
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

export function createMorningBriefingFallback({
  events,
  timeZone,
  members
}: {
  events: MorningBriefingEvent[];
  timeZone: string;
  members: ScheduleDisplayMember[];
}) {
  const dailyRequirements = events.filter((event) => event.kind === 'dailyRequirements');
  const morning = buildPersonLines(dailyRequirements.filter((event) => isMorningEvent(event, timeZone)));
  const afternoon = buildPersonLines(dailyRequirements.filter((event) => !isMorningEvent(event, timeZone)));
  const briefing: MorningBriefing = {
    ...emptyBriefing(fallbackMorningBriefingHeadline(dailyRequirements.length)),
    morning,
    afternoon
  };
  const message = formatMorningBriefing(briefing, members);

  return {
    briefing,
    message,
    sourceIds: [...morning, ...afternoon].flatMap((line) => line.sourceIds)
  };
}

export function formatMorningBriefingFallback({
  events,
  timeZone,
  members
}: {
  events: MorningBriefingEvent[];
  timeZone: string;
  members: ScheduleDisplayMember[];
}) {
  const { message, sourceIds } = createMorningBriefingFallback({ events, timeZone, members });
  return {
    message,
    sourceIds
  };
}

function everyCharacter(value: string, predicate: (character: string | undefined) => boolean) {
  for (const character of value) {
    if (!predicate(character)) return false;
  }
  return true;
}

function isAsciiLetter(character: string | undefined) {
  return character !== undefined && ((character >= 'A' && character <= 'Z') || (character >= 'a' && character <= 'z'));
}

function isAsciiLetterOrDigit(character: string | undefined) {
  return isAsciiLetter(character) || (character !== undefined && character >= '0' && character <= '9');
}

function isAsciiDigit(character: string | undefined) {
  return character !== undefined && character >= '0' && character <= '9';
}

function isAsciiHexDigit(character: string | undefined) {
  return (
    isAsciiDigit(character) ||
    (character !== undefined && character >= 'A' && character <= 'F') ||
    (character !== undefined && character >= 'a' && character <= 'f')
  );
}
