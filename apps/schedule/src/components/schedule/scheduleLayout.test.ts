import { describe, expect, it } from 'vitest';

import { getEventPosition, getNextUpEvent, getOverlapJoiners, normalizeScheduleEvents } from './scheduleLayout';

const monday = new Date(2026, 5, 1, 0, 0, 0).getTime();

describe('schedule layout helpers', () => {
  it('normalizes timed Convex events into generic member ids and day labels', () => {
    const [event] = normalizeScheduleEvents(
      [
        {
          _id: 'event1',
          _creationTime: 1,
          googleEventId: 'g1',
          calendarId: 'cal',
          start: new Date(2026, 5, 1, 9, 30).getTime(),
          end: new Date(2026, 5, 1, 10, 45).getTime(),
          allDay: false,
          title: 'Training',
          who: ['memberA'],
          recurring: true,
          htmlLink: 'https://calendar.google.com/event?eid=1'
        }
      ],
      monday
    );

    expect(event).toMatchObject({
      id: 'event1',
      day: 'Mon',
      title: 'Training',
      who: ['memberA'],
      startMinutes: 570,
      endMinutes: 645,
      recurring: true
    });
  });

  it('treats all-day end dates as exclusive when spanning days', () => {
    const events = normalizeScheduleEvents(
      [
        {
          _id: 'event1',
          _creationTime: 1,
          googleEventId: 'g1',
          calendarId: 'cal',
          start: new Date(2026, 5, 2, 0, 0).getTime(),
          end: new Date(2026, 5, 4, 0, 0).getTime(),
          allDay: true,
          title: 'Camp',
          who: ['shared'],
          recurring: false,
          htmlLink: 'https://calendar.google.com/event?eid=1'
        }
      ],
      monday
    );

    expect(events.map((event) => event.day)).toEqual(['Tue', 'Wed']);
    expect(events.every((event) => event.allDay)).toBe(true);
    expect(events.every((event) => event.who.length === 4)).toBe(true);
  });

  it('clamps event position to the 6am to 10pm ruler', () => {
    expect(getEventPosition({ startMinutes: 5 * 60, endMinutes: 7 * 60 })).toEqual({
      leftPercent: 0,
      widthPercent: 6.25
    });
  });

  it('creates joiners only for overlapping events that do not share members', () => {
    const events = normalizeScheduleEvents(
      [
        {
          _id: 'event1',
          _creationTime: 1,
          googleEventId: 'g1',
          calendarId: 'cal',
          start: new Date(2026, 5, 1, 16, 0).getTime(),
          end: new Date(2026, 5, 1, 17, 0).getTime(),
          allDay: false,
          title: 'One',
          who: ['memberA'],
          recurring: false,
          htmlLink: 'https://calendar.google.com/event?eid=1'
        },
        {
          _id: 'event2',
          _creationTime: 1,
          googleEventId: 'g2',
          calendarId: 'cal',
          start: new Date(2026, 5, 1, 16, 30).getTime(),
          end: new Date(2026, 5, 1, 17, 30).getTime(),
          allDay: false,
          title: 'Two',
          who: ['memberB'],
          recurring: false,
          htmlLink: 'https://calendar.google.com/event?eid=2'
        }
      ],
      monday
    );

    expect(getOverlapJoiners(events)).toHaveLength(1);
  });

  it('finds the next event after the current time', () => {
    const events = normalizeScheduleEvents(
      [
        {
          _id: 'event1',
          _creationTime: 1,
          googleEventId: 'g1',
          calendarId: 'cal',
          start: new Date(2026, 5, 1, 8, 0).getTime(),
          end: new Date(2026, 5, 1, 9, 0).getTime(),
          allDay: false,
          title: 'Past',
          who: ['memberA'],
          recurring: false,
          htmlLink: 'https://calendar.google.com/event?eid=1'
        },
        {
          _id: 'event2',
          _creationTime: 1,
          googleEventId: 'g2',
          calendarId: 'cal',
          start: new Date(2026, 5, 1, 16, 0).getTime(),
          end: new Date(2026, 5, 1, 17, 0).getTime(),
          allDay: false,
          title: 'Next',
          who: ['memberB'],
          recurring: false,
          htmlLink: 'https://calendar.google.com/event?eid=2'
        }
      ],
      monday
    );

    expect(getNextUpEvent(events, new Date(2026, 5, 1, 12, 0).getTime())?.title).toBe('Next');
  });
});
