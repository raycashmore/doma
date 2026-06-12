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

  const sections = ['Morning briefing'];
  const items = [
    ...briefing.routineItems,
    ...briefing.importantItems,
    ...briefing.timingNotes,
    ...briefing.uncertaintyNotes
  ];

  if (items.length > 0) {
    sections.push([briefing.headline, ...items.map((item) => `- ${item.text}`)].join('\n'));
  } else {
    sections.push(briefing.headline);
  }

  return sections.join('\n\n');
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
        tags: ['bring'],
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

export function formatMorningBriefingFallback({ events }: { events: MorningBriefingEvent[] }) {
  const dailyRequirements = events.filter((event) => event.kind === 'dailyRequirements');
  const lines = ['Morning briefing', "I couldn't summarise the day automatically."];

  if (dailyRequirements.length === 0) {
    lines.push('No daily requirements found.');
  } else {
    lines.push("Today's requirements:", ...dailyRequirements.map((requirement) => `- ${requirementText(requirement)}`));
  }

  return {
    message: lines.join('\n\n').replace(/\n\n- /g, '\n- '),
    sourceIds: dailyRequirements.map(sourceIdForEvent)
  };
}
