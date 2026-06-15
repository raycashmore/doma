import type { CalendarConfig, ScheduleEventRow } from '../schedule/mapping';
import { zonedDateStartMs } from '../schedule/week';

export type BriefingKind = 'morning';

export type BriefingItem = {
  text: string;
  kind: 'routine' | 'important' | 'timing' | 'uncertain';
  tags: ('wear' | 'bring' | 'prepare' | 'remember' | 'coordinate' | 'leaveEarlier')[];
  sourceIds: string[];
};

export type MorningBriefing = {
  shouldSend: boolean;
  headline: string;
  routineItems: BriefingItem[];
  importantItems: BriefingItem[];
  timingNotes: BriefingItem[];
  uncertaintyNotes: BriefingItem[];
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
    routineItems: [],
    importantItems: [],
    timingNotes: [],
    uncertaintyNotes: [],
    sourceIdsIgnored: []
  };
}

export function formatMorningBriefing(briefing: MorningBriefing) {
  if (!briefing.shouldSend) return '';

  const lines = ['Morning briefing', briefing.headline];
  const groupedRoutineItems = new Set<BriefingItem>();
  const beforeLeaving = briefing.routineItems.filter((item) =>
    hasAnyTag(item, ['wear', 'remember', 'prepare', 'leaveEarlier'])
  );
  beforeLeaving.forEach((item) => groupedRoutineItems.add(item));

  const packBring = briefing.routineItems.filter((item) => {
    if (groupedRoutineItems.has(item) || !hasAnyTag(item, ['bring'])) return false;
    groupedRoutineItems.add(item);
    return true;
  });

  const coordinatedRoutineItems = briefing.routineItems.filter((item) => {
    if (groupedRoutineItems.has(item) || !hasAnyTag(item, ['coordinate'])) return false;
    groupedRoutineItems.add(item);
    return true;
  });
  const ungroupedRoutineItems = briefing.routineItems.filter((item) => {
    if (groupedRoutineItems.has(item)) return false;
    groupedRoutineItems.add(item);
    return true;
  });

  appendSection(lines, 'Watchouts', briefing.importantItems);
  appendSection(lines, 'Before leaving', [...beforeLeaving, ...ungroupedRoutineItems]);
  appendSection(lines, 'Pack / bring', packBring);
  appendSection(lines, 'Logistics', [...coordinatedRoutineItems, ...briefing.timingNotes]);
  appendSection(lines, 'Unclear', briefing.uncertaintyNotes);

  return lines.join('\n');
}

function appendSection(lines: string[], heading: string, items: BriefingItem[]) {
  if (items.length === 0) return;

  lines.push(heading, ...items.map((item) => `- ${item.text}`));
}

function hasAnyTag(item: BriefingItem, tags: BriefingItem['tags']) {
  return tags.some((tag) => item.tags.includes(tag));
}

export function createDeterministicMorningBriefing({
  localDate,
  timeZone,
  events,
  calendarConfigs
}: {
  localDate: string;
  timeZone: string;
  calendarConfigs: CalendarConfig[];
  events: MorningBriefingEvent[];
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
      message: formatMorningBriefing(briefing)
    };
  }

  const localEvents = collectMorningBriefingEvents({ events, localDate, timeZone });
  const dailyRequirements = localEvents.filter((event) => event.kind === 'dailyRequirements');

  if (dailyRequirements.length > 0) {
    const routineItems = dailyRequirements.map((requirement): BriefingItem => {
      const sourceId = sourceIdForEvent(requirement);
      return {
        text: requirementText(requirement),
        kind: 'routine',
        tags: requirementTags(requirement),
        sourceIds: [sourceId]
      };
    });
    const briefing: MorningBriefing = {
      ...emptyBriefing("Today's requirements"),
      routineItems
    };
    return {
      briefingKind: 'morning',
      localDate,
      generationStatus: 'deterministic',
      sourceIds: routineItems.flatMap((item) => item.sourceIds),
      briefing,
      message: formatMorningBriefing(briefing)
    };
  }

  const briefing = emptyBriefing('Normal day. No special requirements found.');
  return {
    briefingKind: 'morning',
    localDate,
    generationStatus: 'deterministic',
    sourceIds: [],
    briefing,
    message: formatMorningBriefing(briefing)
  };
}

function requirementText(event: MorningBriefingEvent) {
  const detail = event.description?.trim() || event.title.trim();
  return `${event.who.join(', ')}: ${detail}`;
}

function requirementTags(event: MorningBriefingEvent): BriefingItem['tags'] {
  const detail = (event.description?.trim() || event.title.trim()).toLowerCase();

  if (/\b(wear|uniform|clothes|shoes)\b/.test(detail)) return ['wear'];
  if (/\b(remember|homework|prepare|prep|check)\b/.test(detail)) return ['remember'];
  if (/\b(leave early|leave earlier|early)\b/.test(detail)) return ['leaveEarlier'];
  if (/\b(drop|pickup|pick up|handoff|collect)\b/.test(detail)) return ['coordinate'];

  return ['bring'];
}

export function formatMorningBriefingFallback({ events }: { events: MorningBriefingEvent[] }) {
  const dailyRequirements = events.filter((event) => event.kind === 'dailyRequirements');
  const routineItems = dailyRequirements.map((requirement): BriefingItem => {
    const sourceId = sourceIdForEvent(requirement);
    return {
      text: requirementText(requirement),
      kind: 'routine',
      tags: requirementTags(requirement),
      sourceIds: [sourceId]
    };
  });
  const briefing: MorningBriefing = {
    ...emptyBriefing("I couldn't summarise the day automatically."),
    routineItems
  };
  const message = formatMorningBriefing(briefing);

  return {
    message: dailyRequirements.length === 0 ? `${message}\nNo daily requirements found.` : message,
    sourceIds: routineItems.flatMap((item) => item.sourceIds)
  };
}
