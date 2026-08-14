import { describe, expect, it } from 'vitest';

import { upcomingBriefingDeliverySlots } from './deliverySchedule';

describe('upcomingBriefingDeliverySlots', () => {
  it('creates morning retry slots from 8:20am at their Sydney-local times', () => {
    const slots = upcomingBriefingDeliverySlots({
      nowMs: Date.parse('2026-06-11T22:00:00.000Z'),
      timeZone: 'Australia/Sydney',
      horizonMs: 2 * 60 * 60 * 1000
    });

    expect(slots).toEqual([
      {
        key: 'morning:2026-06-12:morning:08:20',
        localDate: '2026-06-12',
        slot: 'morning',
        scheduledAt: Date.parse('2026-06-11T22:20:00.000Z')
      },
      {
        key: 'morning:2026-06-12:morning:08:25',
        localDate: '2026-06-12',
        slot: 'morning',
        scheduledAt: Date.parse('2026-06-11T22:25:00.000Z')
      },
      {
        key: 'morning:2026-06-12:morning:08:30',
        localDate: '2026-06-12',
        slot: 'morning',
        scheduledAt: Date.parse('2026-06-11T22:30:00.000Z')
      },
      {
        key: 'morning:2026-06-12:morning:08:35',
        localDate: '2026-06-12',
        slot: 'morning',
        scheduledAt: Date.parse('2026-06-11T22:35:00.000Z')
      },
      {
        key: 'morning:2026-06-12:morning:08:40',
        localDate: '2026-06-12',
        slot: 'morning',
        scheduledAt: Date.parse('2026-06-11T22:40:00.000Z')
      },
      {
        key: 'morning:2026-06-12:morning:08:45',
        localDate: '2026-06-12',
        slot: 'morning',
        scheduledAt: Date.parse('2026-06-11T22:45:00.000Z')
      }
    ]);
  });

  it('uses AEDT when calculating a morning slot', () => {
    const slots = upcomingBriefingDeliverySlots({
      nowMs: Date.parse('2026-01-11T20:00:00.000Z'),
      timeZone: 'Australia/Sydney',
      horizonMs: 2 * 60 * 60 * 1000
    });

    expect(slots[0]).toEqual({
      key: 'morning:2026-01-12:morning:08:20',
      localDate: '2026-01-12',
      slot: 'morning',
      scheduledAt: Date.parse('2026-01-11T21:20:00.000Z')
    });
  });

  it('creates afternoon slots on weekdays but not Saturday or Sunday', () => {
    const slots = upcomingBriefingDeliverySlots({
      nowMs: Date.parse('2026-06-12T04:00:00.000Z'),
      timeZone: 'Australia/Sydney',
      horizonMs: 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000
    });

    expect(slots.filter((slot) => slot.slot === 'afternoon')).toEqual([
      {
        key: 'morning:2026-06-12:afternoon:14:30',
        localDate: '2026-06-12',
        slot: 'afternoon',
        scheduledAt: Date.parse('2026-06-12T04:30:00.000Z')
      },
      {
        key: 'morning:2026-06-12:afternoon:14:40',
        localDate: '2026-06-12',
        slot: 'afternoon',
        scheduledAt: Date.parse('2026-06-12T04:40:00.000Z')
      },
      {
        key: 'morning:2026-06-12:afternoon:14:50',
        localDate: '2026-06-12',
        slot: 'afternoon',
        scheduledAt: Date.parse('2026-06-12T04:50:00.000Z')
      },
      {
        key: 'morning:2026-06-15:afternoon:14:30',
        localDate: '2026-06-15',
        slot: 'afternoon',
        scheduledAt: Date.parse('2026-06-15T04:30:00.000Z')
      },
      {
        key: 'morning:2026-06-15:afternoon:14:40',
        localDate: '2026-06-15',
        slot: 'afternoon',
        scheduledAt: Date.parse('2026-06-15T04:40:00.000Z')
      },
      {
        key: 'morning:2026-06-15:afternoon:14:50',
        localDate: '2026-06-15',
        slot: 'afternoon',
        scheduledAt: Date.parse('2026-06-15T04:50:00.000Z')
      }
    ]);
  });

  it('returns timestamp-sorted slots and excludes slots before now', () => {
    const nowMs = Date.parse('2026-06-12T22:25:00.000Z');
    const slots = upcomingBriefingDeliverySlots({
      nowMs,
      timeZone: 'Australia/Sydney',
      horizonMs: 24 * 60 * 60 * 1000
    });

    expect(slots.map((slot) => slot.scheduledAt)).toEqual([
      Date.parse('2026-06-12T22:25:00.000Z'),
      Date.parse('2026-06-12T22:30:00.000Z'),
      Date.parse('2026-06-12T22:35:00.000Z'),
      Date.parse('2026-06-12T22:40:00.000Z'),
      Date.parse('2026-06-12T22:45:00.000Z'),
      Date.parse('2026-06-13T22:20:00.000Z'),
      Date.parse('2026-06-13T22:25:00.000Z')
    ]);
    expect(slots.every((slot) => slot.scheduledAt >= nowMs)).toBe(true);
  });
});
