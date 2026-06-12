import {
  DAY_LABELS,
  type DayLabel,
  MEMBER_IDS,
  type MemberId,
  MEMBERS,
  type ScheduleMember,
  SWIMLANE_END_MINUTES,
  SWIMLANE_START_MINUTES,
  SWIMLANE_TOTAL_MINUTES
} from './scheduleData';

export type ConvexScheduleEvent = {
  _id: string;
  _creationTime: number;
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

export type ScheduleEvent = {
  id: string;
  googleEventId: string;
  day: DayLabel;
  start: number;
  end: number;
  startMinutes: number;
  endMinutes: number;
  allDay: boolean;
  title: string;
  kind?: 'dailyRequirements';
  description?: string;
  location?: string;
  who: MemberId[];
  recurring: boolean;
  htmlLink: string;
};

export type EventPosition = {
  leftPercent: number;
  widthPercent: number;
};

export type OverlapJoiner = {
  id: string;
  day: DayLabel;
  startMinutes: number;
  endMinutes: number;
  fromMemberIndex: number;
  toMemberIndex: number;
};

// The backend emits generic member ids (memberA–memberD) or the literal
// "shared". Real member names live only in Convex env `tokens`, never in git
// (see docs/schedule-ingestion-setup.md). This map also acts as the allowlist:
// any id outside it falls back to the first lane.
const SOURCE_MEMBER_TO_GENERIC: Record<string, MemberId> = {
  memberA: 'memberA',
  memberB: 'memberB',
  memberC: 'memberC',
  memberD: 'memberD'
};

function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function minutesSinceLocalMidnight(ms: number): number {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
}

function dayIndexFor(ms: number, weekStartMs: number): number {
  return Math.round((startOfLocalDay(ms) - startOfLocalDay(weekStartMs)) / 86_400_000);
}

function normalizeMembers(who: string[]): MemberId[] {
  const mapped = who.flatMap((id) => {
    if (id === 'shared') return MEMBER_IDS;
    const member = SOURCE_MEMBER_TO_GENERIC[id];
    return member ? [member] : [];
  });
  const uniqueMembers = [...new Set(mapped)];
  return uniqueMembers.length > 0 ? uniqueMembers : [MEMBER_IDS[0]];
}

function buildEventForDay(event: ConvexScheduleEvent, dayIndex: number): ScheduleEvent {
  const day = DAY_LABELS[dayIndex];
  if (!day) {
    throw new Error(`Invalid schedule day index: ${dayIndex}`);
  }
  return {
    id: event._id,
    googleEventId: event.googleEventId,
    day,
    start: event.start,
    end: event.end,
    startMinutes: event.allDay ? SWIMLANE_START_MINUTES : minutesSinceLocalMidnight(event.start),
    endMinutes: event.allDay ? SWIMLANE_END_MINUTES : minutesSinceLocalMidnight(event.end),
    allDay: event.allDay,
    title: event.title,
    kind: event.kind,
    description: event.description,
    location: event.location,
    who: normalizeMembers(event.who),
    recurring: event.recurring,
    htmlLink: event.htmlLink
  };
}

export function normalizeScheduleEvents(events: ConvexScheduleEvent[], weekStartMs: number): ScheduleEvent[] {
  return events.flatMap((event) => {
    if (!event.allDay) {
      const index = dayIndexFor(event.start, weekStartMs);
      return index >= 0 && index < DAY_LABELS.length ? [buildEventForDay(event, index)] : [];
    }

    const firstIndex = dayIndexFor(event.start, weekStartMs);
    const exclusiveEndIndex = dayIndexFor(event.end, weekStartMs);
    const days: ScheduleEvent[] = [];
    for (let index = Math.max(0, firstIndex); index < Math.min(DAY_LABELS.length, exclusiveEndIndex); index += 1) {
      days.push(buildEventForDay(event, index));
    }
    return days;
  });
}

export function getEventPosition(event: Pick<ScheduleEvent, 'startMinutes' | 'endMinutes'>): EventPosition {
  const visibleStart = Math.max(SWIMLANE_START_MINUTES, event.startMinutes);
  const visibleEnd = Math.min(SWIMLANE_END_MINUTES, event.endMinutes);
  const widthMinutes = Math.max(0, visibleEnd - visibleStart);
  return {
    leftPercent: ((visibleStart - SWIMLANE_START_MINUTES) / SWIMLANE_TOTAL_MINUTES) * 100,
    widthPercent: (widthMinutes / SWIMLANE_TOTAL_MINUTES) * 100
  };
}

export function getOverlapJoiners(events: ScheduleEvent[], members: ScheduleMember[] = MEMBERS): OverlapJoiner[] {
  const joiners: OverlapJoiner[] = [];
  for (const [i, a] of events.entries()) {
    for (const b of events.slice(i + 1)) {
      if (a.day !== b.day) continue;
      if (a.startMinutes >= b.endMinutes || b.startMinutes >= a.endMinutes) continue;
      if (a.who.some((member) => b.who.includes(member))) continue;

      const aIndex = Math.min(...a.who.map((member) => members.findIndex((candidate) => candidate.id === member)));
      const bIndex = Math.min(...b.who.map((member) => members.findIndex((candidate) => candidate.id === member)));
      joiners.push({
        id: `${a.id}-${b.id}`,
        day: a.day,
        startMinutes: Math.max(a.startMinutes, b.startMinutes),
        endMinutes: Math.min(a.endMinutes, b.endMinutes),
        fromMemberIndex: Math.min(aIndex, bIndex),
        toMemberIndex: Math.max(aIndex, bIndex)
      });
    }
  }
  return joiners;
}

export function getNextUpEvent(events: ScheduleEvent[], nowMs: number): ScheduleEvent | null {
  return events.filter((event) => event.start >= nowMs).sort((a, b) => a.start - b.start)[0] ?? null;
}
