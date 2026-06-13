import type { CalendarConfig } from '../schedule/mapping';
import {
  collectMorningBriefingEvents,
  createDeterministicMorningBriefing,
  type DeterministicMorningBriefing,
  formatMorningBriefing,
  formatMorningBriefingFallback,
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
  'Select only things that affect readiness: wear, bring, prepare, remember, coordinate, or leave earlier.',
  'Daily requirements sources are authoritative. Ordinary schedule sources are timing and coordination context.',
  'Use soft wording for inferred or uncertain requirements.',
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
  let briefing: MorningBriefing | null;
  try {
    briefing = parseAiBriefing(await provider(input), new Set(input.sources.map((source) => source.sourceId)));
  } catch {
    briefing = null;
  }
  if (!briefing) {
    const fallback = formatMorningBriefingFallback({ events: localEvents });
    return {
      briefingKind: 'morning',
      localDate,
      generationStatus: 'fallback',
      briefing: {
        shouldSend: true,
        headline: "I couldn't summarise the day automatically.",
        routineItems: [],
        importantItems: [],
        timingNotes: [],
        uncertaintyNotes: [],
        sourceIdsIgnored: []
      },
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
  if (event.kind === 'dailyRequirements' && event.description) source.description = event.description;
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
