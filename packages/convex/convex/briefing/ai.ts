import type { CalendarConfig } from '../schedule/mapping';
import { serializeError } from './errors';
import {
  collectMorningBriefingEvents,
  createDeterministicMorningBriefing,
  createMorningBriefingFallback,
  type DeterministicMorningBriefing,
  formatMorningBriefing,
  type MorningBriefing,
  type MorningBriefingEvent,
  sourceIdForEvent
} from './morning';

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
};

export type MorningBriefingAiProvider = (input: MorningBriefingAiInput) => Promise<unknown>;

export const morningBriefingSystemPrompt = [
  'You write a short household morning briefing.',
  'Group the day by household readiness, not raw calendar order.',
  'Select only things that affect readiness: wear, bring, prepare, remember, coordinate, or leave earlier.',
  'Daily requirements sources are authoritative. Ordinary schedule sources are timing and coordination context.',
  'merge duplicate obligations into one concise item when the same action applies to multiple people.',
  'Convert events into responsibilities: who needs to do what, by when, or for whom.',
  'Use importantItems only for watchouts: handoffs, split responsibilities, unusual timing, forgotten-item risk, or tonight-only chores.',
  'Use routineItems for before-leaving and pack-or-bring actions. Use tags to decide the rendered section.',
  'Use timingNotes only for logistics that help the household coordinate.',
  'Use uncertaintyNotes only when a requirement is inferred or needs checking.',
  'Keep low-priority ordinary events out unless they change readiness or coordination.',
  'Use generic, concise wording from the supplied sources and do not invent private details.',
  'Return only the requested structured object. Use the supplied sourceId values exactly.'
].join('\n');

export const morningBriefingOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'shouldSend',
    'headline',
    'routineItems',
    'importantItems',
    'timingNotes',
    'uncertaintyNotes',
    'sourceIdsIgnored'
  ],
  properties: {
    shouldSend: { type: 'boolean' },
    headline: { type: 'string' },
    routineItems: { type: 'array', items: briefingItemJsonSchema('routine') },
    importantItems: { type: 'array', items: briefingItemJsonSchema('important') },
    timingNotes: { type: 'array', items: briefingItemJsonSchema('timing') },
    uncertaintyNotes: { type: 'array', items: briefingItemJsonSchema('uncertain') },
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
  provider
}: {
  localDate: string;
  timeZone: string;
  calendarConfigs: CalendarConfig[];
  events: MorningBriefingEvent[];
  provider: MorningBriefingAiProvider;
}): Promise<DeterministicMorningBriefing> {
  if (!calendarConfigs.some((calendar) => calendar.kind === 'dailyRequirements')) {
    return createDeterministicMorningBriefing({ localDate, timeZone, calendarConfigs, events });
  }

  const localEvents = collectMorningBriefingEvents({ events, localDate, timeZone });
  const input = {
    localDate,
    timeZone,
    sources: localEvents.map(toAiSource)
  };
  const sourceSummary = summarizeSources(input.sources);
  let briefing: MorningBriefing | null;
  try {
    const aiResponse = await provider(input);
    briefing = parseAiBriefing(aiResponse, new Set(input.sources.map((source) => source.sourceId)));

    if (!briefing) {
      console.error('[briefing.ai] Falling back after invalid morning briefing AI response', {
        localDate,
        timeZone,
        ...sourceSummary,
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
    const fallback = createMorningBriefingFallback({ events: localEvents });
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
    return createDeterministicMorningBriefing({ localDate, timeZone, calendarConfigs, events });
  }

  return {
    briefingKind: 'morning',
    localDate,
    generationStatus: 'ai',
    briefing,
    message: formatMorningBriefing(briefing),
    sourceIds: sourceIdsUsedBy(briefing)
  };
}

function briefingItemJsonSchema(kind: MorningBriefing['routineItems'][number]['kind']) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'kind', 'tags', 'sourceIds'],
    properties: {
      text: { type: 'string' },
      kind: { type: 'string', enum: [kind] },
      tags: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['wear', 'bring', 'prepare', 'remember', 'coordinate', 'leaveEarlier']
        }
      },
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
  return (
    !briefing.shouldSend ||
    [...briefing.routineItems, ...briefing.importantItems, ...briefing.timingNotes, ...briefing.uncertaintyNotes]
      .length === 0
  );
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

function parseAiBriefing(value: unknown, knownSourceIds: Set<string>): MorningBriefing | null {
  if (!isRecord(value)) return null;
  if (typeof value.shouldSend !== 'boolean' || typeof value.headline !== 'string') return null;

  const sourceIdsIgnored = parseSourceIds(value.sourceIdsIgnored, knownSourceIds);
  const routineItems = parseItems(value.routineItems, 'routine', knownSourceIds);
  const importantItems = parseItems(value.importantItems, 'important', knownSourceIds);
  const timingNotes = parseItems(value.timingNotes, 'timing', knownSourceIds);
  const uncertaintyNotes = parseItems(value.uncertaintyNotes, 'uncertain', knownSourceIds);

  if (!routineItems || !importantItems || !timingNotes || !uncertaintyNotes || !sourceIdsIgnored) {
    return null;
  }
  return {
    shouldSend: value.shouldSend,
    headline: value.headline,
    routineItems,
    importantItems,
    timingNotes,
    uncertaintyNotes,
    sourceIdsIgnored
  };
}

function parseItems(
  value: unknown,
  kind: MorningBriefing['routineItems'][number]['kind'],
  knownSourceIds: Set<string>
) {
  if (!Array.isArray(value)) return null;
  const items = value.map((item) => {
    if (!isRecord(item) || typeof item.text !== 'string' || item.kind !== kind || !Array.isArray(item.tags)) {
      return null;
    }
    const sourceIds = parseSourceIds(item.sourceIds, knownSourceIds);
    if (!sourceIds || !item.tags.every(isBriefingTag)) return null;
    return {
      text: item.text,
      kind,
      tags: item.tags,
      sourceIds
    };
  });
  return items.every((item) => item !== null) ? items : null;
}

function parseSourceIds(value: unknown, knownSourceIds: Set<string>) {
  if (!Array.isArray(value)) return null;
  if (!value.every((sourceId): sourceId is string => typeof sourceId === 'string')) return null;
  return value.every((sourceId) => knownSourceIds.has(sourceId)) ? value : null;
}

function sourceIdsUsedBy(briefing: MorningBriefing) {
  return [
    ...briefing.routineItems,
    ...briefing.importantItems,
    ...briefing.timingNotes,
    ...briefing.uncertaintyNotes
  ].flatMap((item) => item.sourceIds);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBriefingTag(value: unknown): value is MorningBriefing['routineItems'][number]['tags'][number] {
  return (
    value === 'wear' ||
    value === 'bring' ||
    value === 'prepare' ||
    value === 'remember' ||
    value === 'coordinate' ||
    value === 'leaveEarlier'
  );
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
    routineItemsCount: Array.isArray(value.routineItems) ? value.routineItems.length : null,
    importantItemsCount: Array.isArray(value.importantItems) ? value.importantItems.length : null,
    timingNotesCount: Array.isArray(value.timingNotes) ? value.timingNotes.length : null,
    uncertaintyNotesCount: Array.isArray(value.uncertaintyNotes) ? value.uncertaintyNotes.length : null,
    sourceIdsIgnoredCount: Array.isArray(value.sourceIdsIgnored) ? value.sourceIdsIgnored.length : null
  };
}
