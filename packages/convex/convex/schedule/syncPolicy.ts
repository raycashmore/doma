// Decide whether an on-demand refresh can reuse the data we already have.
//
// The schedule app triggers a sync on load and on a manual refresh button.
// To avoid re-hitting the Google Calendar API on every mount, an unforced
// refresh is skipped when the last successful sync is still within the
// freshness window. The manual button passes `force` to bypass this.
export function shouldSkipSync(lastSyncedAt: number | null, now: number, force: boolean, freshMs: number): boolean {
  if (force) return false;
  if (lastSyncedAt === null) return false;
  return now - lastSyncedAt < freshMs;
}
