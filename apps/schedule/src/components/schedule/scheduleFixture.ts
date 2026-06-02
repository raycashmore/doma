import type { ConvexScheduleEvent } from './scheduleLayout';

function dayMs(weekStartMs: number, dayOffset: number, hour: number, minute = 0): number {
  const date = new Date(weekStartMs);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

export function createFixtureScheduleEvents(weekStartMs: number): ConvexScheduleEvent[] {
  return [
    {
      _id: 'fixture-1',
      _creationTime: 1,
      googleEventId: 'fixture-google-1',
      calendarId: 'fixture',
      start: dayMs(weekStartMs, 0, 8, 30),
      end: dayMs(weekStartMs, 0, 15, 15),
      allDay: false,
      title: 'School',
      who: ['memberC', 'memberD'],
      recurring: true,
      htmlLink: 'https://calendar.google.com/'
    },
    {
      _id: 'fixture-2',
      _creationTime: 1,
      googleEventId: 'fixture-google-2',
      calendarId: 'fixture',
      start: dayMs(weekStartMs, 0, 16),
      end: dayMs(weekStartMs, 0, 17, 30),
      allDay: false,
      title: 'Training',
      location: 'Community centre',
      who: ['memberC'],
      recurring: true,
      htmlLink: 'https://calendar.google.com/'
    },
    {
      _id: 'fixture-3',
      _creationTime: 1,
      googleEventId: 'fixture-google-3',
      calendarId: 'fixture',
      start: dayMs(weekStartMs, 0, 16, 15),
      end: dayMs(weekStartMs, 0, 17),
      allDay: false,
      title: 'Swim lesson',
      location: 'Pool',
      who: ['memberD'],
      recurring: true,
      htmlLink: 'https://calendar.google.com/'
    },
    {
      _id: 'fixture-4',
      _creationTime: 1,
      googleEventId: 'fixture-google-4',
      calendarId: 'fixture',
      start: dayMs(weekStartMs, 0, 18, 30),
      end: dayMs(weekStartMs, 0, 19, 30),
      allDay: false,
      title: 'Family dinner',
      location: 'Home',
      who: ['shared'],
      recurring: false,
      htmlLink: 'https://calendar.google.com/'
    },
    {
      _id: 'fixture-5',
      _creationTime: 1,
      googleEventId: 'fixture-google-5',
      calendarId: 'fixture',
      start: dayMs(weekStartMs, 2, 17),
      end: dayMs(weekStartMs, 2, 18, 30),
      allDay: false,
      title: 'Practice',
      location: 'Park',
      who: ['memberA', 'memberC'],
      recurring: true,
      htmlLink: 'https://calendar.google.com/'
    },
    {
      _id: 'fixture-6',
      _creationTime: 1,
      googleEventId: 'fixture-google-6',
      calendarId: 'fixture',
      start: dayMs(weekStartMs, 5, 0),
      end: dayMs(weekStartMs, 7, 0),
      allDay: true,
      title: 'Weekend away',
      who: ['shared'],
      recurring: false,
      htmlLink: 'https://calendar.google.com/'
    }
  ];
}
