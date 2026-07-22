import {
  calendarDateInTimeZone,
  shiftCalendarDate,
  weekFactsForCalendarDate,
  zonedCalendarDateTimeMs
} from '../calendarDate';

export type ScheduledBriefingDeliverySlot = {
  key: string;
  localDate: string;
  slot: 'morning' | 'afternoon';
  scheduledAt: number;
};

type UpcomingBriefingDeliverySlotsOptions = {
  nowMs: number;
  timeZone: string;
  horizonMs: number;
};

const morningRetryTimes = [
  { hour: 7, minute: 35 },
  { hour: 7, minute: 45 },
  { hour: 7, minute: 55 },
  { hour: 8, minute: 5 },
  { hour: 8, minute: 15 },
  { hour: 8, minute: 25 }
];

const afternoonRetryTimes = [
  { hour: 14, minute: 30 },
  { hour: 14, minute: 40 },
  { hour: 14, minute: 50 }
];

export function upcomingBriefingDeliverySlots({
  nowMs,
  timeZone,
  horizonMs
}: UpcomingBriefingDeliverySlotsOptions): ScheduledBriefingDeliverySlot[] {
  const horizonEndMs = nowMs + horizonMs;
  const slots: ScheduledBriefingDeliverySlot[] = [];
  const lastLocalDate = calendarDateInTimeZone(new Date(horizonEndMs), timeZone);

  for (
    let localDate = calendarDateInTimeZone(new Date(nowMs), timeZone);
    localDate <= lastLocalDate;
    localDate = shiftCalendarDate(localDate, 1)
  ) {
    appendSlots(slots, { localDate, slot: 'morning', retryTimes: morningRetryTimes, nowMs, horizonEndMs, timeZone });

    const { weekday } = weekFactsForCalendarDate(localDate);
    if (weekday !== 'saturday' && weekday !== 'sunday') {
      appendSlots(slots, {
        localDate,
        slot: 'afternoon',
        retryTimes: afternoonRetryTimes,
        nowMs,
        horizonEndMs,
        timeZone
      });
    }
  }

  return slots.sort((left, right) => left.scheduledAt - right.scheduledAt);
}

function appendSlots(
  slots: ScheduledBriefingDeliverySlot[],
  options: {
    localDate: string;
    slot: ScheduledBriefingDeliverySlot['slot'];
    retryTimes: { hour: number; minute: number }[];
    nowMs: number;
    horizonEndMs: number;
    timeZone: string;
  }
) {
  for (const { hour, minute } of options.retryTimes) {
    const scheduledAt = zonedCalendarDateTimeMs(options.localDate, hour, minute, options.timeZone);
    if (scheduledAt < options.nowMs || scheduledAt > options.horizonEndMs) continue;

    slots.push({
      key: `morning:${options.localDate}:${options.slot}:${formatTime(hour, minute)}`,
      localDate: options.localDate,
      slot: options.slot,
      scheduledAt
    });
  }
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
