import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventPanel } from './EventPanel';
import type { ScheduleMember } from './scheduleData';
import type { ScheduleEvent } from './scheduleLayout';

const members: ScheduleMember[] = [
  { id: 'memberA', label: 'Child A', initials: 'CA', colorClass: 'member-a' },
  { id: 'memberB', label: 'Child B', initials: 'CB', colorClass: 'member-b' },
  { id: 'memberC', label: 'Child C', initials: 'CC', colorClass: 'member-c' },
  { id: 'memberD', label: 'Child D', initials: 'CD', colorClass: 'member-d' }
];

afterEach(() => cleanup());

describe('EventPanel', () => {
  it('shows notes for daily requirements events while preserving the calendar link', () => {
    const event: ScheduleEvent = {
      id: 'event1',
      googleEventId: 'g1',
      day: 'Mon',
      start: new Date(2026, 5, 1).getTime(),
      end: new Date(2026, 5, 2).getTime(),
      startMinutes: 360,
      endMinutes: 1320,
      allDay: true,
      title: 'Child A sports uniform',
      description: 'Bring hat and water bottle',
      kind: 'dailyRequirements',
      location: 'Campus',
      who: ['memberA'],
      recurring: false,
      htmlLink: 'https://calendar.google.com/event?eid=1'
    };

    render(<EventPanel event={event} members={members} open onClose={vi.fn()} />);

    expect(screen.getByText('Requirement notes')).toBeTruthy();
    expect(screen.getByText('Bring hat and water bottle')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Google Calendar/i }).getAttribute('href')).toBe(event.htmlLink);
  });
});
