import { describe, expect, it } from 'vitest';

import { currentWeekRange, planningHorizonRange, zonedDateStartMs } from './week';

describe('currentWeekRange', () => {
  it('returns Monday 00:00 to next Monday 00:00 in UTC', () => {
    // 2026-05-31T05:00Z is a Sunday
    const { timeMin, timeMax } = currentWeekRange(new Date('2026-05-31T05:00:00Z'), 'UTC');
    expect(timeMin).toBe('2026-05-25T00:00:00.000Z');
    expect(timeMax).toBe('2026-06-01T00:00:00.000Z');
  });

  it('computes the week in a non-UTC, no-DST zone (Brisbane +10)', () => {
    // Sunday 15:00 Brisbane time
    const { timeMin, timeMax } = currentWeekRange(new Date('2026-05-31T05:00:00Z'), 'Australia/Brisbane');
    expect(timeMin).toBe('2026-05-24T14:00:00.000Z'); // Mon 00:00 Brisbane
    expect(timeMax).toBe('2026-05-31T14:00:00.000Z'); // next Mon 00:00 Brisbane
  });

  it('treats Monday itself as the start of its own week', () => {
    // 2026-05-25T09:00Z is a Monday
    const { timeMin } = currentWeekRange(new Date('2026-05-25T09:00:00Z'), 'UTC');
    expect(timeMin).toBe('2026-05-25T00:00:00.000Z');
  });

  it('handles an exact local-midnight instant (Brisbane)', () => {
    // 2026-05-24T14:00:00Z == 2026-05-25T00:00:00 Brisbane (a Monday)
    const { timeMin, timeMax } = currentWeekRange(new Date('2026-05-24T14:00:00Z'), 'Australia/Brisbane');
    expect(timeMin).toBe('2026-05-24T14:00:00.000Z'); // that same Monday 00:00 Brisbane
    expect(timeMax).toBe('2026-05-31T14:00:00.000Z');
  });
});

describe('planningHorizonRange', () => {
  it('covers the current and following calendar weeks for meal planning', () => {
    expect(planningHorizonRange(new Date('2026-05-31T05:00:00Z'), 'UTC')).toEqual({
      timeMin: '2026-05-25T00:00:00.000Z',
      timeMax: '2026-06-08T00:00:00.000Z'
    });
  });
});

describe('zonedDateStartMs', () => {
  it('is UTC midnight in UTC', () => {
    expect(zonedDateStartMs('2026-05-26', 'UTC')).toBe(Date.parse('2026-05-26T00:00:00Z'));
  });

  it('anchors to local midnight in a +10 zone (Brisbane)', () => {
    // 00:00 on 2026-05-26 in Brisbane is the previous day 14:00 UTC.
    expect(zonedDateStartMs('2026-05-26', 'Australia/Brisbane')).toBe(Date.parse('2026-05-25T14:00:00Z'));
  });

  it('anchors to local midnight in a negative-offset zone (New York -4 DST)', () => {
    // 00:00 on 2026-05-26 in New York (EDT, -4) is 04:00 UTC the same day —
    // the case that previously rendered all-day events on the wrong day.
    expect(zonedDateStartMs('2026-05-26', 'America/New_York')).toBe(Date.parse('2026-05-26T04:00:00Z'));
  });
});
