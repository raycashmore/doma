import { describe, expect, it } from 'vitest';

import { type CalendarConfig, deriveWho, type GoogleEvent, type MemberConfig, toScheduleEvent } from './mapping';

const members: MemberConfig[] = [
  { id: 'memberA', tokens: ['Aria', 'mum'] },
  { id: 'memberB', tokens: ['Boyd', 'dad'] },
  { id: 'memberC', tokens: ['Cleo'] }
];
const personal: CalendarConfig = { calendarId: 'cal-a@group', who: 'memberA' };
const shared: CalendarConfig = { calendarId: 'cal-shared@group', who: 'shared' };

describe('deriveWho', () => {
  it('maps a per-person calendar to that member', () => {
    expect(deriveWho('Anything', personal, members)).toEqual(['memberA']);
  });

  it('defaults shared events with no name token to the first member', () => {
    expect(deriveWho('Family dinner', shared, members)).toEqual(['memberA']);
  });

  it('matches a name token in a shared event title (case-insensitive)', () => {
    expect(deriveWho('cleo — swim lesson', shared, members)).toEqual(['memberC']);
  });

  it('matches multiple members named in one shared title', () => {
    expect(deriveWho('Aria and Boyd brunch', shared, members)).toEqual(['memberA', 'memberB']);
  });

  it('does not match a token embedded inside another word', () => {
    // "dad" token must not match "Dadaism"
    expect(deriveWho('Dadaism exhibition', shared, members)).toEqual(['memberA']);
  });
});

describe('toScheduleEvent', () => {
  const base: GoogleEvent = {
    id: 'evt-1',
    summary: 'Swim',
    htmlLink: 'https://calendar.google.com/evt-1',
    start: { dateTime: '2026-05-26T16:00:00Z' },
    end: { dateTime: '2026-05-26T17:00:00Z' }
  };

  it('shapes a timed event (dateTime offset is zone-correct regardless of tz)', () => {
    expect(toScheduleEvent(base, personal, members, 'Australia/Brisbane')).toEqual({
      googleEventId: 'evt-1',
      calendarId: 'cal-a@group',
      start: Date.parse('2026-05-26T16:00:00Z'),
      end: Date.parse('2026-05-26T17:00:00Z'),
      allDay: false,
      title: 'Swim',
      who: ['memberA'],
      recurring: false,
      htmlLink: 'https://calendar.google.com/evt-1'
    });
  });

  const allDay: GoogleEvent = {
    id: 'evt-2',
    summary: 'School',
    htmlLink: 'https://calendar.google.com/evt-2',
    start: { date: '2026-05-26' },
    end: { date: '2026-05-27' }
  };

  it('flags all-day events and omits location when absent', () => {
    const row = toScheduleEvent(allDay, personal, members, 'UTC');
    expect(row.allDay).toBe(true);
    expect(row.start).toBe(Date.parse('2026-05-26T00:00:00Z'));
    expect(row.location).toBeUndefined();
  });

  it('anchors all-day events to local midnight in tz (Brisbane +10)', () => {
    const row = toScheduleEvent(allDay, personal, members, 'Australia/Brisbane');
    // 00:00 on 2026-05-26 in Brisbane is 2026-05-25T14:00:00Z — not UTC midnight,
    // so the event still falls on the 26th for the calendar owner.
    expect(row.start).toBe(Date.parse('2026-05-25T14:00:00Z'));
    expect(row.end).toBe(Date.parse('2026-05-26T14:00:00Z'));
  });

  it('detects recurrence and passes through location and title fallback', () => {
    const ev: GoogleEvent = {
      id: 'evt-3',
      htmlLink: 'https://calendar.google.com/evt-3',
      location: 'Studio 12',
      recurringEventId: 'evt-3-base',
      start: { dateTime: '2026-05-26T16:00:00Z' },
      end: { dateTime: '2026-05-26T17:00:00Z' }
    };
    const row = toScheduleEvent(ev, personal, members, 'UTC');
    expect(row.recurring).toBe(true);
    expect(row.location).toBe('Studio 12');
    expect(row.title).toBe('(no title)');
  });

  it('throws when start/end timestamps are missing', () => {
    const ev: GoogleEvent = {
      id: 'evt-bad',
      htmlLink: 'https://calendar.google.com/evt-bad',
      start: {},
      end: {}
    };
    expect(() => toScheduleEvent(ev, personal, members, 'UTC')).toThrow();
  });
});

describe('deriveWho token escaping', () => {
  it('treats regex special characters in tokens literally', () => {
    const m: MemberConfig[] = [
      { id: 'memberX', tokens: ['A+B'] },
      { id: 'memberY', tokens: ['Zed'] }
    ];
    const sharedCal: CalendarConfig = { calendarId: 'cal-s', who: 'shared' };
    // Literal "A+B" matches; the "+" must not act as a regex quantifier.
    expect(deriveWho('A+B study group', sharedCal, m)).toEqual(['memberX']);
    // "AAB" would match if "+" were treated as a quantifier (one-or-more A).
    // With escaping it does not, so no member is named -> the first member.
    expect(deriveWho('AAB study group', sharedCal, m)).toEqual(['memberX']);
  });
});
