export type BotCapabilityRequest = {
  userId: string;
  command?: string;
  messageText: string;
  receivedAt: number;
};

export type BotCapabilityResponse = { kind: 'reply'; text: string; parseMode?: 'HTML' } | { kind: 'no_response' };

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
  parseMode?: 'HTML';
  shouldSend: boolean;
  generationStatus: 'ai' | 'deterministic' | 'fallback' | 'setupProblem';
};

export type BotBriefingDeliverySlot = 'morning' | 'afternoon';

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
  loadMorningBriefingDeliveryPreview?: (input: {
    localDate: string;
    timeZone: string;
    generatedAt: number;
    slot: BotBriefingDeliverySlot;
  }) => Promise<BotMorningBriefing>;
  markMorningBriefingDelivered?: (input: {
    briefingKey: string;
    recipientUserId: string;
    attemptedAt: number;
  }) => Promise<unknown>;
};

const MAX_EVENTS = 5;
const MORNING_BRIEFING_FALLBACK_TEXT = 'I could not load the morning briefing just now.';

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

function briefingDeliverySlotAsk(text: string): BotBriefingDeliverySlot | null {
  const normalized = text.trim().toLowerCase();
  const match =
    /^\/briefing(?:@\w+)?\s+(morning|afternoon)\b/.exec(normalized) ??
    /^\/schedule(?:@\w+)?\s+briefing\s+(morning|afternoon)\b/.exec(normalized);

  return match ? (match[1] as BotBriefingDeliverySlot) : null;
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

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    message: String(error)
  };
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
    loadMorningBriefingDeliveryPreview,
    markMorningBriefingDelivered,
    nowMs = Date.now(),
    timeZone = 'Australia/Sydney'
  }: HandleScheduleCapabilityOptions
): Promise<BotCapabilityResponse> {
  if (isBriefingAsk(request.messageText)) {
    const deliverySlot = briefingDeliverySlotAsk(request.messageText);
    if (deliverySlot) {
      if (!loadMorningBriefingDeliveryPreview) {
        return { kind: 'reply', text: MORNING_BRIEFING_FALLBACK_TEXT };
      }

      const localDate = formatLocalDate(nowMs, timeZone);
      let briefing: BotMorningBriefing;

      try {
        briefing = await loadMorningBriefingDeliveryPreview({
          localDate,
          timeZone,
          generatedAt: nowMs,
          slot: deliverySlot
        });
      } catch (error) {
        console.error('[schedule.bot] Morning briefing delivery preview failed', {
          localDate,
          timeZone,
          deliverySlot,
          error: errorDetails(error)
        });
        return { kind: 'reply', text: MORNING_BRIEFING_FALLBACK_TEXT };
      }

      return {
        kind: 'reply',
        text:
          briefing.shouldSend && briefing.message.trim().length > 0
            ? briefing.message
            : `Nothing to flag this ${deliverySlot}.`,
        ...(briefing.shouldSend && briefing.message.trim().length > 0 && briefing.parseMode
          ? { parseMode: briefing.parseMode }
          : {})
      };
    }

    if (!loadMorningBriefing || !generateMorningBriefing || !markMorningBriefingDelivered) {
      return { kind: 'reply', text: MORNING_BRIEFING_FALLBACK_TEXT };
    }

    const localDate = formatLocalDate(nowMs, timeZone);
    let briefing: BotMorningBriefing;

    try {
      briefing =
        (await loadMorningBriefing({ localDate })) ??
        (await generateMorningBriefing({ localDate, timeZone, generatedAt: nowMs }));
    } catch (error) {
      console.error('[schedule.bot] Morning briefing request failed', {
        localDate,
        timeZone,
        error: errorDetails(error)
      });
      return { kind: 'reply', text: MORNING_BRIEFING_FALLBACK_TEXT };
    }

    try {
      await markMorningBriefingDelivered({
        briefingKey: briefing.briefingKey,
        recipientUserId: request.userId,
        attemptedAt: nowMs
      });
    } catch (error) {
      console.warn('[schedule.bot] Morning briefing delivery record failed', {
        briefingKey: briefing.briefingKey,
        localDate,
        error: errorDetails(error)
      });
    }

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
