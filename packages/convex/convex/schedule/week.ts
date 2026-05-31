// Milliseconds to add to a UTC instant to get the wall-clock time in `tz`.
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const p = Object.fromEntries(
    dtf.formatToParts(date).map((part) => [part.type, part.value])
  );
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second)
  );
  return asUTC - date.getTime();
}

/**
 * The current calendar week (Monday 00:00 inclusive → next Monday 00:00
 * exclusive) expressed in `tz`, returned as UTC ISO strings for the Google
 * Calendar `timeMin`/`timeMax` query params.
 *
 * NOTE (v1): the tz offset is sampled at `now`; a DST transition mid-week is
 * not corrected. Acceptable for a family scheduler.
 */
export function currentWeekRange(
  now: Date,
  tz: string
): { timeMin: string; timeMax: string } {
  const offset = tzOffsetMs(now, tz);
  const local = new Date(now.getTime() + offset);
  const dow = local.getUTCDay(); // 0=Sun..6=Sat (on the shifted wall-clock date)
  const daysFromMon = (dow + 6) % 7;
  const monLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysFromMon
  );
  const nextMonLocal = monLocal + 7 * 24 * 60 * 60 * 1000;
  return {
    timeMin: new Date(monLocal - offset).toISOString(),
    timeMax: new Date(nextMonLocal - offset).toISOString()
  };
}
