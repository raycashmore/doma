'use client';

import { api } from '@repo/convex';
import { useAction, useQuery } from 'convex/react';
import { useEffect, useMemo, useState } from 'react';

import { EventPanel } from './EventPanel';
import { MobileSchedule } from './MobileSchedule';
import { DAY_LABELS, type DayLabel, resolveScheduleMembers } from './scheduleData';
import { createFixtureScheduleEvents } from './scheduleFixture';
import { getNextUpEvent, normalizeScheduleEvents, type ScheduleEvent } from './scheduleLayout';
import { ScheduleSwimlanes } from './ScheduleSwimlanes';
import { SyncBanner } from './SyncBanner';

const USE_DEV_FIXTURE = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function getWeekStartMs(now = new Date()): number {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.getTime();
}

function getDayLabelForDate(now: Date, weekStartMs: number): DayLabel | undefined {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const index = Math.round((today - weekStartMs) / 86_400_000);
  return DAY_LABELS[index];
}

function getNowMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function ScheduleScreen() {
  const data = useQuery(api.schedule.queries.currentWeek, USE_DEV_FIXTURE ? 'skip' : {});
  const refresh = useAction(api.schedule.sync.refresh);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [refreshError, setRefreshError] = useState<string>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const weekStartMs = useMemo(() => getWeekStartMs(), []);
  const now = useMemo(() => new Date(), []);
  const todayDay = getDayLabelForDate(now, weekStartMs);
  const nowMinutes = getNowMinutes(now);
  const sourceEvents = useMemo(
    () => (USE_DEV_FIXTURE ? createFixtureScheduleEvents(weekStartMs) : (data?.events ?? [])),
    [data?.events, weekStartMs]
  );
  const lastSyncedAt = USE_DEV_FIXTURE ? Date.now() : (data?.lastSyncedAt ?? null);
  const events = useMemo(() => normalizeScheduleEvents(sourceEvents, weekStartMs), [sourceEvents, weekStartMs]);
  const members = useMemo(() => resolveScheduleMembers(data?.members), [data?.members]);
  const nextUp = useMemo(() => getNextUpEvent(events, Date.now()), [events]);

  useEffect(() => {
    if (USE_DEV_FIXTURE) return;
    let cancelled = false;
    setIsRefreshing(true);
    void refresh({ force: false })
      .catch((error: unknown) => {
        if (!cancelled) setRefreshError(error instanceof Error ? error.message : 'Refresh failed');
      })
      .finally(() => {
        if (!cancelled) setIsRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleRefresh = () => {
    if (USE_DEV_FIXTURE) return;
    setRefreshError(undefined);
    setIsRefreshing(true);
    void refresh({ force: true })
      .catch((error: unknown) => {
        setRefreshError(error instanceof Error ? error.message : 'Refresh failed');
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  };

  if (!USE_DEV_FIXTURE && data === undefined) {
    return <div className="schedule-shell schedule-shell--loading">Loading schedule...</div>;
  }

  return (
    <section className="schedule-shell" aria-label="Family schedule">
      <SyncBanner
        lastSyncedAt={lastSyncedAt}
        isRefreshing={isRefreshing}
        error={refreshError}
        onRefresh={handleRefresh}
      />
      <ScheduleSwimlanes
        events={events}
        members={members}
        nextUp={nextUp}
        selectedEventId={selectedEvent?.id}
        todayDay={todayDay}
        nowMinutes={nowMinutes}
        weekStartMs={weekStartMs}
        onSelect={setSelectedEvent}
      />
      <MobileSchedule
        events={events}
        members={members}
        nextUp={nextUp}
        selectedEventId={selectedEvent?.id}
        todayDay={todayDay}
        onSelect={setSelectedEvent}
      />
      <EventPanel
        event={selectedEvent}
        members={members}
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
      />
    </section>
  );
}
