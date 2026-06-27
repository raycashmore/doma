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
  | { reason: 'invalid_lines_array'; section: BriefingSection }
  | {
      reason: 'invalid_line_shape' | 'invalid_line_who' | 'invalid_line_source_ids';
      section: BriefingSection;
      lineIndex: number;
    };

export const morningBriefingSystemPrompt = [
  'You write a short household morning briefing — a readiness summary, not a calendar dump.',
  'Write a specific, useful, one-line headline in a lightly characterful household-assistant voice.',
  'Avoid generic headlines such as "Morning and afternoon readiness", "Today has a few things", or "Today\'s requirements".',
  'Group the day into two time blocks: morning and afternoon.',
  'Assign obligations by the underlying activity local start time; pre-noon activities belong in morning.',
  'Assign each obligation to the block when the underlying activity happens, even if it is prepared earlier (kit for an afternoon class is an afternoon item).',
  "Within each block, produce one line per responsible person, combining that person's obligations into one natural sentence.",
  'Set "who" to the exact supplied member ids the line is for. Do not put the person\'s name inside "text"; only describe the obligation.',
  'Only include people who have something in that block. Do not emit lines for idle people and never write "normal day".',
  'Daily requirements sources are authoritative. Ordinary schedule sources are timing and coordination context.',
  'Put an obligation in "watchouts" instead of a block line ONLY when it is a genuine issue: a schedule clash, unusual or off-pattern timing, or a high-stakes forgotten-item risk (passport, medication, signed form — not everyday water bottles).',
  'An obligation is either a block line or a watchout, never both. Keep run-of-the-mill handoffs and pickups as ordinary block lines.',
  'Keep low-priority ordinary events out unless they change readiness or coordination.',
  'Use supplied weather only when it changes readiness. Never invent weather, locations, or private details beyond supplied weather and schedule sources.',
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
    sources: localEvents.map(toAiSource),
    ...(weather ? { weather } : {})
  };
  const sourceSummary = summarizeSources(input.sources);
  let briefing: MorningBriefing | null;
  try {
    const aiResponse = await provider(input);
    const parseResult = parseAiBriefing(aiResponse, new Set(input.sources.map((source) => source.sourceId)));
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

function toAiSource(event: MorningBriefingEvent): MorningBriefingAiSource {
  const source: MorningBriefingAiSource = {
    sourceId: sourceIdForEvent(event),
    calendarId: event.calendarId,
    kind: event.kind === 'dailyRequirements' ? 'dailyRequirements' : 'schedule',
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    who: event.who,
    recurring: event.recurring
  };
  if (event.location) source.location = event.location;
  if (event.description) source.description = event.description;
  return source;
}

function parseAiBriefing(
  value: unknown,
  knownSourceIds: Set<string>
): { briefing: MorningBriefing | null; failure?: AiBriefingParseFailure } {
  if (!isRecord(value)) return { briefing: null, failure: { reason: 'not_object' } };
  if (typeof value.shouldSend !== 'boolean' || typeof value.headline !== 'string') {
    return { briefing: null, failure: { reason: 'invalid_top_level_fields' } };
  }

  const sourceIdsIgnored = parseSourceIds(value.sourceIdsIgnored, knownSourceIds);
  if (!sourceIdsIgnored) {
    return { briefing: null, failure: { reason: 'invalid_source_ids_ignored_shape' } };
  }

  const morning = parseLines(value.morning, 'morning', knownSourceIds);
  if (!morning.lines) return { briefing: null, failure: morning.failure };

  const afternoon = parseLines(value.afternoon, 'afternoon', knownSourceIds);
  if (!afternoon.lines) return { briefing: null, failure: afternoon.failure };

  const watchouts = parseLines(value.watchouts, 'watchouts', knownSourceIds);
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

function parseLines(value: unknown, section: BriefingSection, knownSourceIds: Set<string>) {
  if (!Array.isArray(value)) {
    return { lines: null, failure: { reason: 'invalid_lines_array', section } satisfies AiBriefingParseFailure };
  }
  const parsed = value.map((line, lineIndex) => {
    if (!isRecord(line) || typeof line.text !== 'string') {
      return { line: null, failure: { reason: 'invalid_line_shape', section, lineIndex } };
    }
    if (!Array.isArray(line.who) || !line.who.every((id): id is string => typeof id === 'string')) {
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
