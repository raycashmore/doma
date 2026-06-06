import { describe, expect, it } from 'vitest';

import { resolveScheduleMembers } from './scheduleData';

describe('resolveScheduleMembers', () => {
  it('overlays private display labels onto the fixed generic member lanes', () => {
    expect(
      resolveScheduleMembers([
        { id: 'memberA', label: 'Person One', initials: 'PO' },
        { id: 'memberC', label: 'Person Three', initials: 'PT' },
        { id: 'unknown', label: 'Ignored', initials: 'I' }
      ])
    ).toEqual([
      { id: 'memberA', label: 'Person One', initials: 'PO', colorClass: 'member-a' },
      { id: 'memberB', label: 'Member B', initials: 'B', colorClass: 'member-b' },
      { id: 'memberC', label: 'Person Three', initials: 'PT', colorClass: 'member-c' },
      { id: 'memberD', label: 'Member D', initials: 'D', colorClass: 'member-d' }
    ]);
  });
});
