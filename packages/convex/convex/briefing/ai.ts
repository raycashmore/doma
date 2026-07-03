import type { ScheduleDisplayMember } from '../schedule/config';
import type { CalendarConfig } from '../schedule/mapping';
import { serializeError } from './errors';
import {
  type BriefingLine,
  collectMorningBriefingEvents,
  createDeterministicMorningBriefing,
  createMorningBriefingFallback,
  type DeterministicMorningBriefing,
  formatMorningBriefing,
  type MorningBriefing,
  type MorningBriefingEvent,
  sourceIdForEvent
} from './morning';
import type { MorningBriefingWeatherContext } from './weather';

export type MorningBriefingAiSource = {
  sourceId: string;
  calendarId: string;
  kind: 'dailyRequirements' | 'schedule';
  title: string;
  start: number;
  end: number;
  localStart: string;
  localEnd: string;
  localTimeBlock: 'morning' | 'afternoon';
  allDay: boolean;
  who: string[];
  recurring: boolean;
  location?: string;
  description?: string;
};

export type MorningBriefingAiInput = {
  localDate: string;
  timeZone: string;
  sources: MorningBriefingAiSource[];
  weather?: MorningBriefingWeatherContext;
};

export type MorningBriefingAiProvider = (input: MorningBriefingAiInput) => Promise<unknown>;

type BriefingSection = 'morning' | 'afternoon' | 'watchouts';

type AiBriefingParseFailure =
  | { reason: 'not_object' }
  | { reason: 'invalid_top_level_fields' }
  | { reason: 'invalid_source_ids_ignored_shape' }
  | { reason: 'invalid_headline_text' }
  | { reason: 'invalid_lines_array'; section: BriefingSection }
  | {
      reason: 'invalid_line_shape' | 'invalid_line_text' | 'invalid_line_who' | 'invalid_line_source_ids';
      section: BriefingSection;
      lineIndex: number;
    };

export const morningBriefingSystemPrompt = [
  'You write a short household morning briefing — a readiness summary, not a calendar dump.',
  'Write a specific, useful, one-line headline in a lightly characterful household-assistant voice.',
  'Avoid generic headlines such as "Morning and afternoon readiness", "Today has a few things", or "Today\'s requirements".',
  'Group the day into two time blocks: morning and afternoon.',
  'Use each source localTimeBlock when assigning obligations; pre-noon localStart values belong in morning.',
  'Assign each obligation to the block when the underlying activity happens, even if it is prepared earlier (kit for an afternoon class is an afternoon item).',
  "Within each block, produce one line per responsible person, combining that person's obligations into one natural sentence.",
  'Set "who" to the exact supplied member ids the line is for. Do not put the person\'s name inside "text"; only describe the obligation.',
  'Write headline and line text as plain text. Do not include HTML, escaped HTML entities, or markup. Do not write member ids inside prose.',
  'Only include people who have something in that block. Do not emit lines for idle people and never write "normal day".',
  'Daily requirements sources are authoritative. Ordinary schedule sources are timing and coordination context.',
  'Put an obligation in "watchouts" instead of a block line ONLY when it is a genuine issue: a schedule clash, unusual or off-pattern timing, or a high-stakes forgotten-item risk (passport, medication, signed form — not everyday water bottles).',
  'An obligation is either a block line or a watchout, never both. Keep run-of-the-mill handoffs and pickups as ordinary block lines.',
  'Keep low-priority ordinary events out unless they change readiness or coordination.',
  'Use supplied weather only when it changes readiness. Never invent weather, locations, or private details beyond supplied weather and schedule sources.',
  'If supplied weather mentions high humidity for allergy control, include one brief, calm mention in the headline or relevant block.',
  'Use generic, concise wording from the supplied sources and do not invent private details.',
  'Set shouldSend to false only when there is genuinely nothing worth sending.',
  'Return only the requested structured object. Use the supplied sourceId values exactly.'
].join('\n');

export const morningBriefingOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['shouldSend', 'headline', 'morning', 'afternoon', 'watchouts', 'sourceIdsIgnored'],
  properties: {
    shouldSend: { type: 'boolean' },
    headline: { type: 'string' },
    morning: { type: 'array', items: briefingLineJsonSchema() },
    afternoon: { type: 'array', items: briefingLineJsonSchema() },
    watchouts: { type: 'array', items: briefingLineJsonSchema() },
    sourceIdsIgnored: { type: 'array', items: { type: 'string' } }
  }
} as const;

export function createOpenAiMorningBriefingProvider({
  apiKey,
  model,
  fetchImpl = fetch
}: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): MorningBriefingAiProvider {
  return async (input) => {
    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: morningBriefingSystemPrompt },
          { role: 'user', content: JSON.stringify(input) }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'morning_briefing',
            strict: true,
            schema: morningBriefingOutputJsonSchema
          }
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Morning briefing AI request failed with status ${response.status}`);
    }
    const body = (await response.json()) as unknown;
    const content = openAiMessageContent(body);
    if (!content) throw new Error('Morning briefing AI response did not include JSON content');
    return JSON.parse(content) as unknown;
  };
}

export async function createAiMorningBriefing({
  localDate,
  timeZone,
  calendarConfigs,
  events,
  provider,
  members,
  weather
}: {
  localDate: string;
  timeZone: string;
  calendarConfigs: CalendarConfig[];
  events: MorningBriefingEvent[];
  provider: MorningBriefingAiProvider;
  members: ScheduleDisplayMember[];
  weather?: MorningBriefingWeatherContext;
}): Promise<DeterministicMorningBriefing> {
  if (!calendarConfigs.some((calendar) => calendar.kind === 'dailyRequirements')) {
    return createDeterministicMorningBriefing({ localDate, timeZone, calendarConfigs, events, members });
  }

  const localEvents = collectMorningBriefingEvents({ events, localDate, timeZone });
  const input = {
    localDate,
    timeZone,
    sources: localEvents.map((event) => toAiSource(event, timeZone)),
    ...(weather ? { weather } : {})
  };
  const sourceSummary = summarizeSources(input.sources);
  let briefing: MorningBriefing | null;
  try {
    const aiResponse = await provider(input);
    const parseResult = parseAiBriefing(
      aiResponse,
      new Set(input.sources.map((source) => source.sourceId)),
      new Set(members.map((member) => member.id))
    );
    briefing = parseResult.briefing;

    if (!briefing) {
      console.error('[briefing.ai] Falling back after invalid morning briefing AI response', {
        localDate,
        timeZone,
        ...sourceSummary,
        parseFailure: parseResult.failure,
        responseShape: describeAiResponseShape(aiResponse)
      });
    }
  } catch (error) {
    console.error('[briefing.ai] Falling back after morning briefing AI provider failure', {
      localDate,
      timeZone,
      ...sourceSummary,
      error: serializeError(error)
    });
    briefing = null;
  }
  if (!briefing) {
    const fallback = createMorningBriefingFallback({ events: localEvents, timeZone, members });
    return {
      briefingKind: 'morning',
      localDate,
      generationStatus: 'fallback',
      briefing: fallback.briefing,
      message: fallback.message,
      sourceIds: fallback.sourceIds
    };
  }
  if (isEmptyBriefing(briefing) && isWeekday(localDate, timeZone)) {
    return createDeterministicMorningBriefing({ localDate, timeZone, calendarConfigs, events, members });
  }

  return {
    briefingKind: 'morning',
    localDate,
    generationStatus: 'ai',
    briefing,
    message: formatMorningBriefing(briefing, members),
    sourceIds: sourceIdsUsedBy(briefing)
  };
}

function briefingLineJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'who', 'sourceIds'],
    properties: {
      text: { type: 'string' },
      who: { type: 'array', items: { type: 'string' } },
      sourceIds: { type: 'array', items: { type: 'string' } }
    }
  } as const;
}

function openAiMessageContent(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.choices)) return null;
  const firstChoice = body.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
  return typeof firstChoice.message.content === 'string' ? firstChoice.message.content : null;
}

function isEmptyBriefing(briefing: MorningBriefing) {
  return !briefing.shouldSend || [...briefing.morning, ...briefing.afternoon, ...briefing.watchouts].length === 0;
}

function isWeekday(localDate: string, timeZone: string) {
  const weekday = new Intl.DateTimeFormat('en-AU', { timeZone, weekday: 'short' }).format(
    new Date(`${localDate}T12:00:00Z`)
  );
  return weekday !== 'Sat' && weekday !== 'Sun';
}

function toAiSource(event: MorningBriefingEvent, timeZone: string): MorningBriefingAiSource {
  const source: MorningBriefingAiSource = {
    sourceId: sourceIdForEvent(event),
    calendarId: event.calendarId,
    kind: event.kind === 'dailyRequirements' ? 'dailyRequirements' : 'schedule',
    title: event.title,
    start: event.start,
    end: event.end,
    localStart: localDateTime(event.start, timeZone),
    localEnd: localDateTime(event.end, timeZone),
    localTimeBlock: localTimeBlock(event.start, timeZone),
    allDay: event.allDay,
    who: event.who,
    recurring: event.recurring
  };
  if (event.location) source.location = event.location;
  if (event.description) source.description = event.description;
  return source;
}

function localDateTime(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(new Date(ms));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

function localTimeBlock(ms: number, timeZone: string): MorningBriefingAiSource['localTimeBlock'] {
  const hour = Number(
    new Intl.DateTimeFormat('en-AU', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(ms))
  );
  return hour < 12 ? 'morning' : 'afternoon';
}

function parseAiBriefing(
  value: unknown,
  knownSourceIds: Set<string>,
  knownMemberIds: Set<string>
): { briefing: MorningBriefing | null; failure?: AiBriefingParseFailure } {
  if (!isRecord(value)) return { briefing: null, failure: { reason: 'not_object' } };
  if (typeof value.shouldSend !== 'boolean' || typeof value.headline !== 'string') {
    return { briefing: null, failure: { reason: 'invalid_top_level_fields' } };
  }
  if (!isPlainBriefingText(value.headline, knownMemberIds)) {
    return { briefing: null, failure: { reason: 'invalid_headline_text' } };
  }

  const sourceIdsIgnored = parseSourceIds(value.sourceIdsIgnored, knownSourceIds);
  if (!sourceIdsIgnored) {
    return { briefing: null, failure: { reason: 'invalid_source_ids_ignored_shape' } };
  }

  const morning = parseLines(value.morning, 'morning', knownSourceIds, knownMemberIds);
  if (!morning.lines) return { briefing: null, failure: morning.failure };

  const afternoon = parseLines(value.afternoon, 'afternoon', knownSourceIds, knownMemberIds);
  if (!afternoon.lines) return { briefing: null, failure: afternoon.failure };

  const watchouts = parseLines(value.watchouts, 'watchouts', knownSourceIds, knownMemberIds);
  if (!watchouts.lines) return { briefing: null, failure: watchouts.failure };

  return {
    briefing: {
      shouldSend: value.shouldSend,
      headline: value.headline,
      morning: morning.lines,
      afternoon: afternoon.lines,
      watchouts: watchouts.lines,
      sourceIdsIgnored
    }
  };
}

function parseLines(
  value: unknown,
  section: BriefingSection,
  knownSourceIds: Set<string>,
  knownMemberIds: Set<string>
) {
  if (!Array.isArray(value)) {
    return { lines: null, failure: { reason: 'invalid_lines_array', section } satisfies AiBriefingParseFailure };
  }
  const parsed = value.map((line, lineIndex) => {
    if (!isRecord(line) || typeof line.text !== 'string') {
      return { line: null, failure: { reason: 'invalid_line_shape', section, lineIndex } };
    }
    if (!isPlainBriefingText(line.text, knownMemberIds)) {
      return { line: null, failure: { reason: 'invalid_line_text', section, lineIndex } };
    }
    if (
      !Array.isArray(line.who) ||
      !line.who.every((id): id is string => typeof id === 'string' && knownMemberIds.has(id))
    ) {
      return { line: null, failure: { reason: 'invalid_line_who', section, lineIndex } };
    }
    const sourceIds = parseSourceIds(line.sourceIds, knownSourceIds);
    if (!sourceIds) return { line: null, failure: { reason: 'invalid_line_source_ids', section, lineIndex } };
    if (sourceIds.length === 0) return { line: null, failure: null };
    return { line: { text: line.text, who: line.who, sourceIds } };
  });
  const invalid = parsed.find((entry) => entry.failure);
  return invalid
    ? { lines: null, failure: invalid.failure as AiBriefingParseFailure }
    : { lines: parsed.map((entry) => entry.line).filter((line): line is BriefingLine => line !== null) };
}

function parseSourceIds(value: unknown, knownSourceIds: Set<string>) {
  if (!Array.isArray(value)) return null;
  if (!value.every((sourceId): sourceId is string => typeof sourceId === 'string')) return null;
  return value.filter((sourceId) => knownSourceIds.has(sourceId));
}

function isPlainBriefingText(text: string, knownMemberIds: Set<string>) {
  return (
    !containsMarkupDelimiter(text) &&
    !containsHtmlEntity(text) &&
    !containsConfiguredMemberToken(text, knownMemberIds) &&
    !containsInternalMemberToken(text)
  );
}

function containsMarkupDelimiter(text: string) {
  return text.includes('<') || text.includes('>');
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
  if (!isAsciiLetter(entity[0] ?? '')) return false;
  return everyCharacter(entity, isAsciiLetterOrDigit);
}

function containsConfiguredMemberToken(text: string, knownMemberIds: Set<string>) {
  for (const memberId of knownMemberIds) {
    if (memberId && containsStandaloneLiteral(text, memberId)) return true;
  }
  return false;
}

function containsInternalMemberToken(text: string) {
  for (const token of plainTextTokens(text)) {
    if (isInternalMemberToken(token)) return true;
  }
  return false;
}

function containsStandaloneLiteral(text: string, literal: string) {
  const lowerText = text.toLowerCase();
  const lowerLiteral = literal.toLowerCase();
  let searchFrom = 0;
  while (searchFrom < lowerText.length) {
    const index = lowerText.indexOf(lowerLiteral, searchFrom);
    if (index === -1) return false;
    const before = index > 0 ? lowerText[index - 1] : undefined;
    const after = lowerText[index + lowerLiteral.length];
    if (!isTextTokenCharacter(before) && !isTextTokenCharacter(after)) return true;
    searchFrom = index + 1;
  }
  return false;
}

function isInternalMemberToken(token: string) {
  const normalized = token.toLowerCase();
  if (!normalized.startsWith('member')) return false;
  const suffix = normalized.slice('member'.length);
  return suffix.length === 1 && suffix !== 's' && isAsciiLetter(suffix);
}

function plainTextTokens(text: string) {
  const tokens: string[] = [];
  let current = '';
  for (const character of text) {
    if (isTokenCharacter(character)) {
      current += character;
    } else if (current) {
      tokens.push(current);
      current = '';
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function isTokenCharacter(character: string) {
  return isAsciiLetterOrDigit(character);
}

function isTextTokenCharacter(character: string | undefined) {
  return character !== undefined && isAsciiLetterOrDigit(character);
}

function everyCharacter(value: string, predicate: (character: string) => boolean) {
  for (const character of value) {
    if (!predicate(character)) return false;
  }
  return true;
}

function isAsciiLetterOrDigit(character: string) {
  return isAsciiLetter(character) || isAsciiDigit(character);
}

function isAsciiLetter(character: string) {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return false;
  return (codePoint >= 65 && codePoint <= 90) || (codePoint >= 97 && codePoint <= 122);
}

function isAsciiDigit(character: string) {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return false;
  return codePoint >= 48 && codePoint <= 57;
}

function isAsciiHexDigit(character: string) {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return false;
  return (
    (codePoint >= 48 && codePoint <= 57) ||
    (codePoint >= 65 && codePoint <= 70) ||
    (codePoint >= 97 && codePoint <= 102)
  );
}

function sourceIdsUsedBy(briefing: MorningBriefing) {
  return [...briefing.morning, ...briefing.afternoon, ...briefing.watchouts].flatMap((line) => line.sourceIds);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function summarizeSources(sources: MorningBriefingAiSource[]) {
  return {
    sourceCount: sources.length,
    requirementSourceCount: sources.filter((source) => source.kind === 'dailyRequirements').length,
    scheduleSourceCount: sources.filter((source) => source.kind === 'schedule').length
  };
}

function describeAiResponseShape(value: unknown) {
  if (!isRecord(value)) {
    return {
      type: Array.isArray(value) ? 'array' : typeof value
    };
  }

  return {
    keys: Object.keys(value).sort(),
    shouldSendType: typeof value.shouldSend,
    headlineType: typeof value.headline,
    morningCount: Array.isArray(value.morning) ? value.morning.length : null,
    afternoonCount: Array.isArray(value.afternoon) ? value.afternoon.length : null,
    watchoutsCount: Array.isArray(value.watchouts) ? value.watchouts.length : null,
    sourceIdsIgnoredCount: Array.isArray(value.sourceIdsIgnored) ? value.sourceIdsIgnored.length : null
  };
}
