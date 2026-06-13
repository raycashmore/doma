export type BotCapabilityRequest = {
  userId: string;
  command?: string;
  messageText: string;
  receivedAt: number;
};

export type BotCapabilityResponse = { kind: 'reply'; text: string } | { kind: 'no_response' };

export type BotScheduleEvent = {
  googleEventId: string;
  start: number;
  end: number;
  allDay: boolean;
  title: string;
  location?: string;
};

export type BotScheduleData = {
  events: BotScheduleEvent[];
};

export type BotMorningBriefing = {
  briefingKey: string;
  localDate: string;
  message: string;
  shouldSend: boolean;
  generationStatus: 'ai' | 'deterministic' | 'fallback' | 'setupProblem';
};

export type HandleScheduleCapabilityOptions = {
  nowMs?: number;
  timeZone?: string;
  loadCurrentWeek: () => Promise<BotScheduleData>;
  loadMorningBriefing?: (input: { localDate: string }) => Promise<BotMorningBriefing | null>;
  generateMorningBriefing?: (input: {
    localDate: string;
    timeZone: string;
    generatedAt: number;
  }) => Promise<BotMorningBriefing>;
  markMorningBriefingDelivered?: (input: {
    briefingKey: string;
    recipientUserId: string;
    attemptedAt: number;
  }) => Promise<unknown>;
};

const MAX_EVENTS = 5;

export function parseBotCapabilityRequest(value: unknown): BotCapabilityRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const request = value as Record<string, unknown>;
  if (
    typeof request.userId !== 'string' ||
    typeof request.messageText !== 'string' ||
    typeof request.receivedAt !== 'number'
  ) {
    return null;
  }

  return {
    userId: request.userId,
    command: typeof request.command === 'string' ? request.command : undefined,
    messageText: request.messageText,
    receivedAt: request.receivedAt
  };
}

function isUpcomingAsk(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === '/schedule' || /^\/schedule(?:@\w+)?\s+upcoming\b/.test(normalized);
}

function isBriefingAsk(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return /^\/briefing(?:@\w+)?(?:\s|$)/.test(normalized) || /^\/schedule(?:@\w+)?\s+briefing\b/.test(normalized);
}

function formatLocalDate(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(ms));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not format local date');
  }

  return `${year}-${month}-${day}`;
}

function formatDayTime(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone
  }).format(new Date(ms));
}

function formatDay(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone
  }).format(new Date(ms));
}

function formatEvent(event: BotScheduleEvent, timeZone: string): string {
  const when = event.allDay ? formatDay(event.start, timeZone) : formatDayTime(event.start, timeZone);
  const location = event.location ? ` (${event.location})` : '';
  return `- ${when}: ${event.title}${location}`;
}

export function formatUpcomingEvents(events: BotScheduleEvent[], nowMs: number, timeZone: string): string {
  const upcoming = events
    .filter((event) => event.start >= nowMs)
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_EVENTS);

  if (upcoming.length === 0) {
    return 'No upcoming events found for the current schedule window.';
  }

  return ['Upcoming events:', ...upcoming.map((event) => formatEvent(event, timeZone))].join('\n');
}

export async function handleScheduleCapabilityRequest(
  request: BotCapabilityRequest,
  {
    loadCurrentWeek,
    loadMorningBriefing,
    generateMorningBriefing,
    markMorningBriefingDelivered,
    nowMs = Date.now(),
    timeZone = 'Australia/Sydney'
  }: HandleScheduleCapabilityOptions
): Promise<BotCapabilityResponse> {
  if (isBriefingAsk(request.messageText)) {
    if (!loadMorningBriefing || !generateMorningBriefing || !markMorningBriefingDelivered) {
      return { kind: 'reply', text: 'I could not load the morning briefing just now.' };
    }

    const localDate = formatLocalDate(nowMs, timeZone);
    const briefing =
      (await loadMorningBriefing({ localDate })) ??
      (await generateMorningBriefing({ localDate, timeZone, generatedAt: nowMs }));

    await markMorningBriefingDelivered({
      briefingKey: briefing.briefingKey,
      recipientUserId: request.userId,
      attemptedAt: nowMs
    });

    const text =
      briefing.shouldSend && briefing.message.trim().length > 0 ? briefing.message : 'Nothing to flag this morning.';

    return {
      kind: 'reply',
      text
    };
  }

  if (!isUpcomingAsk(request.messageText)) {
    return { kind: 'reply', text: 'Try /schedule upcoming to see the next events.' };
  }

  const data = await loadCurrentWeek();
  return {
    kind: 'reply',
    text: formatUpcomingEvents(data.events, nowMs, timeZone)
  };
}
