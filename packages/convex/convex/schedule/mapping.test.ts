import { describe, expect, it } from 'vitest';
import {
  deriveWho,
  toScheduleEvent,
  type CalendarConfig,
  type GoogleEvent,
  type MemberConfig
} from './mapping';

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

  it('defaults shared events with no name token to the whole family', () => {
    expect(deriveWho('Family dinner', shared, members)).toEqual([
      'memberA',
      'memberB',
      'memberC'
    ]);
  });

  it('matches a name token in a shared event title (case-insensitive)', () => {
    expect(deriveWho('cleo — swim lesson', shared, members)).toEqual(['memberC']);
  });

  it('matches multiple members named in one shared title', () => {
    expect(deriveWho('Aria and Boyd brunch', shared, members)).toEqual([
      'memberA',
      'memberB'
    ]);
  });

  it('does not match a token embedded inside another word', () => {
    // "dad" token must not match "Dadaism"
    expect(deriveWho('Dadaism exhibition', shared, members)).toEqual([
      'memberA',
      'memberB',
      'memberC'
    ]);
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

  it('shapes a timed event', () => {
    expect(toScheduleEvent(base, personal, members)).toEqual({
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

  it('flags all-day events and omits location when absent', () => {
    const allDay: GoogleEvent = {
      id: 'evt-2',
      summary: 'School',
      htmlLink: 'https://calendar.google.com/evt-2',
      start: { date: '2026-05-26' },
      end: { date: '2026-05-27' }
    };
    const row = toScheduleEvent(allDay, personal, members);
    expect(row.allDay).toBe(true);
    expect(row.start).toBe(Date.parse('2026-05-26'));
    expect(row.location).toBeUndefined();
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
    const row = toScheduleEvent(ev, personal, members);
    expect(row.recurring).toBe(true);
    expect(row.location).toBe('Studio 12');
    expect(row.title).toBe('(no title)');
  });
});
