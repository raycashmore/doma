import { describe, expect, it } from 'vitest';

import { displayMembersFromConfig, parseScheduleCalendarsFromRaw } from './config';
import type { MemberConfig } from './mapping';

describe('displayMembersFromConfig', () => {
  it('maps member display labels from env-backed member config', () => {
    const members: MemberConfig[] = [
      { id: 'memberA', label: 'Person One', initials: 'PO', tokens: ['One', 'Alpha'] },
      { id: 'memberB', tokens: ['Person Two', 'Beta'] }
    ];

    expect(displayMembersFromConfig(members)).toEqual([
      { id: 'memberA', label: 'Person One', initials: 'PO' },
      { id: 'memberB', label: 'Person Two', initials: 'PT' }
    ]);
  });

  it('falls back to generic labels when display config is absent', () => {
    expect(displayMembersFromConfig([{ id: 'memberC', tokens: [] }])).toEqual([
      { id: 'memberC', label: 'memberC', initials: 'M' }
    ]);
  });
});

describe('parseScheduleCalendarsFromRaw', () => {
  it('accepts daily requirements calendars for shared and person-specific calendars', () => {
    expect(
      parseScheduleCalendarsFromRaw(
        JSON.stringify([
          { calendarId: 'requirements-shared', who: 'shared', kind: 'dailyRequirements' },
          { calendarId: 'requirements-member-a', who: 'memberA', kind: 'dailyRequirements' },
          { calendarId: 'ordinary-member-b', who: 'memberB' }
        ])
      )
    ).toEqual([
      { calendarId: 'requirements-shared', who: 'shared', kind: 'dailyRequirements' },
      { calendarId: 'requirements-member-a', who: 'memberA', kind: 'dailyRequirements' },
      { calendarId: 'ordinary-member-b', who: 'memberB' }
    ]);
  });
});
