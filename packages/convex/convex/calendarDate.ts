export const CALENDAR_WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
] as const;

export function calendarDateInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftCalendarDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});

  return (
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    ) - date.getTime()
  );
}

export function zonedCalendarDateTimeMs(localDate: string, hour: number, minute: number, timeZone: string) {
  const [year, month, day] = localDate.split('-').map(Number) as [number, number, number];
  const wallClockMs = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = wallClockMs - timeZoneOffsetMs(new Date(wallClockMs), timeZone);
  candidate = wallClockMs - timeZoneOffsetMs(new Date(candidate), timeZone);
  return candidate;
}

export function weekFactsForCalendarDate(localDate: string) {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));

  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekday: CALENDAR_WEEKDAYS[day]
  };
}
