import { describe, expect, it } from 'vitest';

import { getDueReminderCandidates, type ReminderEvent, reminderKeyForEvent } from './reminders';

const nowMs = Date.parse('2026-06-06T10:00:00.000Z');

function event(overrides: Partial<ReminderEvent> = {}): ReminderEvent {
  return {
    googleEventId: 'event-1',
    start: nowMs + 30 * 60_000,
    end: nowMs + 60 * 60_000,
    allDay: false,
    title: 'School pickup',
    ...overrides
  };
}

describe('reminderKeyForEvent', () => {
  it('builds a stable key from event identity, start, and lead time', () => {
    expect(reminderKeyForEvent(event(), 30)).toBe(`event-1:${nowMs + 30 * 60_000}:30`);
  });
});

describe('getDueReminderCandidates', () => {
  it('returns no candidates when there are no events', () => {
    expect(
      getDueReminderCandidates({
        events: [],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30
      })
    ).toEqual([]);
  });

  it('returns due events within the reminder window', () => {
    expect(
      getDueReminderCandidates({
        events: [event({ location: 'Main gate' })],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30
      })
    ).toEqual([
      {
        reminderKey: `event-1:${nowMs + 30 * 60_000}:30`,
        googleEventId: 'event-1',
        eventStart: nowMs + 30 * 60_000,
        eventEnd: nowMs + 60 * 60_000,
        leadTimeMinutes: 30,
        title: 'School pickup',
        location: 'Main gate'
      }
    ]);
  });

  it('does not return events before they are due', () => {
    expect(
      getDueReminderCandidates({
        events: [event({ start: nowMs + 45 * 60_000 })],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30
      })
    ).toEqual([]);
  });

  it('does not return already attempted events', () => {
    const candidate = event();
    expect(
      getDueReminderCandidates({
        events: [candidate],
        attempts: [{ reminderKey: reminderKeyForEvent(candidate, 30) }],
        nowMs,
        leadTimeMinutes: 30
      })
    ).toEqual([]);
  });

  it('does not return stale reminder windows', () => {
    expect(
      getDueReminderCandidates({
        events: [event({ start: nowMs + 15 * 60_000 })],
        attempts: [],
        nowMs,
        leadTimeMinutes: 30,
        lookbackMs: 5 * 60_000
      })
    ).toEqual([]);
  });
});
