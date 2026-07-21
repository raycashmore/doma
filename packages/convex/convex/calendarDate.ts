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
