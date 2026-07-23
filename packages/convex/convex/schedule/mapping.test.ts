import { describe, expect, it } from 'vitest';

import { type CalendarConfig, deriveWho, type GoogleEvent, type MemberConfig, toScheduleEvent } from './mapping';

const members: MemberConfig[] = [
  { id: 'memberA', tokens: ['Person One', 'parent'] },
  { id: 'memberB', tokens: ['Person Two'] },
  { id: 'memberC', tokens: ['Person Three', 'Person-Three'] }
];
const personal: CalendarConfig = { calendarId: 'cal-a@group', who: 'memberA' };
const shared: CalendarConfig = { calendarId: 'cal-shared@group', who: 'shared' };

describe('deriveWho', () => {
  it('maps a per-person calendar to that member', () => {
    expect(deriveWho(undefined, personal, members, 'School')).toEqual(['memberA']);
  });

  it('leaves shared events unassigned when they have no owner tag', () => {
    expect(deriveWho(undefined, shared, members, 'Family dinner')).toEqual([]);
  });

  it.each(['Person Three: School', 'person three - School', 'Person-Three: School', 'Person-Three - School'])(
    'uses a configured name in a structured shared-event title prefix: %s',
    (title) => {
      expect(deriveWho(undefined, shared, members, title)).toEqual(['memberC']);
    }
  );

  it('does not infer shared event ownership from a name elsewhere in the title', () => {
    expect(deriveWho(undefined, shared, members, 'Going to School with Person Three')).toEqual([]);
  });

  it('does not treat a hyphen within an ordinary title word as an ownership delimiter', () => {
    expect(deriveWho(undefined, shared, members, 'parent-teacher meeting')).toEqual([]);
  });

  it('uses an embedded owner tag with a configured name as a fallback', () => {
    expect(
      deriveWho('Bring a bag.\nNotes: @doma-owner(person three)\nPickup at 3pm.', shared, members, 'School')
    ).toEqual(['memberC']);
  });

  it('keeps accepting generic member ids in owner tags', () => {
    expect(deriveWho('@doma-owner(memberC)', shared, members, 'School')).toEqual(['memberC']);
  });

  it('prefers a structured title prefix over the description fallback', () => {
    expect(deriveWho('@doma-owner(memberC)', shared, members, 'Person One: School')).toEqual(['memberA']);
  });

  it('rejects an owner tag with an unknown member id', () => {
    expect(deriveWho('@doma-owner(not-a-member)', shared, members, 'School')).toEqual([]);
  });
});

describe('toScheduleEvent', () => {
  const base: GoogleEvent = {
    id: 'evt-1',
    summary: 'Swim',
    description: 'Bring towel and goggles',
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
      description: 'Bring towel and goggles',
      who: ['memberA'],
      recurring: false,
      htmlLink: 'https://calendar.google.com/evt-1'
    });
  });

  it('stores sanitized descriptions for daily requirements events', () => {
    const requirementsCalendar: CalendarConfig = {
      calendarId: 'requirements-calendar',
      who: 'shared',
      kind: 'dailyRequirements'
    };
    const event: GoogleEvent = {
      id: 'evt-requirement',
      summary: 'Child A sports uniform',
      description: '<p>Wear sports uniform&nbsp;</p><p>Bring hat &amp; water bottle</p>',
      htmlLink: 'https://calendar.google.com/evt-requirement',
      start: { date: '2026-05-26' },
      end: { date: '2026-05-27' }
    };

    expect(toScheduleEvent(event, requirementsCalendar, members, 'UTC')).toMatchObject({
      googleEventId: 'evt-requirement',
      kind: 'dailyRequirements',
      description: 'Wear sports uniform\nBring hat & water bottle',
      who: []
    });
  });

  it('uses a shared-event owner tag without including it in the saved description', () => {
    const event: GoogleEvent = {
      id: 'evt-owned',
      summary: 'Dinner with Person One’s group',
      description: 'Meet at 7pm\nNotes: @doma-owner(person two)\nBring dessert',
      htmlLink: 'https://calendar.google.com/evt-owned',
      start: { dateTime: '2026-05-26T16:00:00Z' },
      end: { dateTime: '2026-05-26T17:00:00Z' }
    };

    expect(toScheduleEvent(event, shared, members, 'UTC')).toMatchObject({
      description: 'Meet at 7pm\nNotes:\nBring dessert',
      who: ['memberB']
    });
  });

  it('derives shared-event ownership from a structured title prefix', () => {
    const event: GoogleEvent = {
      ...base,
      summary: 'Person Three - Swim',
      description: undefined
    };

    expect(toScheduleEvent(event, shared, members, 'UTC')).toMatchObject({
      title: 'Person Three - Swim',
      who: ['memberC']
    });
  });

  it('stores sanitized descriptions for ordinary schedule events', () => {
    const event: GoogleEvent = {
      id: 'evt-note',
      summary: 'Swim',
      description: '<p>Bring towel&nbsp;</p><p>Meet near lane 3</p>',
      htmlLink: 'https://calendar.google.com/evt-note',
      start: { dateTime: '2026-05-26T16:00:00Z' },
      end: { dateTime: '2026-05-26T17:00:00Z' }
    };

    expect(toScheduleEvent(event, personal, members, 'UTC')).toMatchObject({
      googleEventId: 'evt-note',
      description: 'Bring towel\nMeet near lane 3'
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
