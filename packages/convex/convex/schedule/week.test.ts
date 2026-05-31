import { describe, expect, it } from 'vitest';
import { currentWeekRange } from './week';

describe('currentWeekRange', () => {
  it('returns Monday 00:00 to next Monday 00:00 in UTC', () => {
    // 2026-05-31T05:00Z is a Sunday
    const { timeMin, timeMax } = currentWeekRange(
      new Date('2026-05-31T05:00:00Z'),
      'UTC'
    );
    expect(timeMin).toBe('2026-05-25T00:00:00.000Z');
    expect(timeMax).toBe('2026-06-01T00:00:00.000Z');
  });

  it('computes the week in a non-UTC, no-DST zone (Brisbane +10)', () => {
    // Sunday 15:00 Brisbane time
    const { timeMin, timeMax } = currentWeekRange(
      new Date('2026-05-31T05:00:00Z'),
      'Australia/Brisbane'
    );
    expect(timeMin).toBe('2026-05-24T14:00:00.000Z'); // Mon 00:00 Brisbane
    expect(timeMax).toBe('2026-05-31T14:00:00.000Z'); // next Mon 00:00 Brisbane
  });

  it('treats Monday itself as the start of its own week', () => {
    // 2026-05-25T09:00Z is a Monday
    const { timeMin } = currentWeekRange(new Date('2026-05-25T09:00:00Z'), 'UTC');
    expect(timeMin).toBe('2026-05-25T00:00:00.000Z');
  });
});
