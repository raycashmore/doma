import { describe, expect, it, vi } from 'vitest';

import { upcomingBriefingDeliverySlots } from './deliverySchedule';

const scheduleStoreMocks = vi.hoisted(() => ({
  internalMutation: vi.fn((definition) => definition),
  scheduledDelivery: Symbol('scheduledDelivery')
}));

vi.mock('../_generated/server', () => ({
  internalMutation: scheduleStoreMocks.internalMutation
}));

vi.mock('../_generated/api', () => ({
  internal: {
    briefing: {
      deliveryRunner: {
        runScheduledMorningBriefingDelivery: scheduleStoreMocks.scheduledDelivery
      }
    }
  }
}));

type DeliveryScheduleRow = {
  _id: string;
  key: string;
  localDate: string;
  slot: 'morning' | 'afternoon';
  scheduledAt: number;
  status: 'scheduled' | 'completed' | 'failed';
  completedAt?: number;
};

function createContext(rows: DeliveryScheduleRow[] = []) {
  let nextId = rows.length;
  const scheduler = { runAt: vi.fn() };
  const db = {
    query: vi.fn(() => ({
      withIndex: vi.fn(
        (_indexName: string, applyIndex: (query: { eq: (field: string, value: string) => unknown }) => unknown) => {
          let key: string | undefined;
          const equal = (_field: string, value: string) => {
            key = value;
            return { eq: equal };
          };
          applyIndex({ eq: equal });
          return {
            unique: async () => rows.find((row) => row.key === key) ?? null
          };
        }
      )
    })),
    insert: vi.fn(async (_table: string, row: Omit<DeliveryScheduleRow, '_id'>) => {
      const id = `slot_${nextId++}`;
      rows.push({ _id: id, ...row });
      return id;
    }),
    patch: vi.fn(async (id: string, value: Partial<DeliveryScheduleRow>) => {
      const row = rows.find((candidate) => candidate._id === id);
      if (!row) throw new Error(`Unknown row: ${id}`);
      Object.assign(row, value);
    })
  };

  return { ctx: { db, scheduler }, rows, scheduler, db };
}

describe('briefing delivery schedule store', () => {
  it('reconciles each future slot only once across repeated runs', async () => {
    const nowMs = Date.parse('2026-06-11T21:00:00.000Z');
    const expectedSlots = upcomingBriefingDeliverySlots({
      nowMs,
      timeZone: 'Australia/Sydney',
      horizonMs: 48 * 60 * 60 * 1000
    });
    const { reconcileMorningBriefingDeliverySchedule } = (await import('./deliveryScheduleStore')) as unknown as {
      reconcileMorningBriefingDeliverySchedule: {
        handler: (ctx: ReturnType<typeof createContext>['ctx'], args: Record<string, never>) => Promise<unknown>;
      };
    };
    const { ctx, rows, scheduler, db } = createContext();
    vi.spyOn(Date, 'now').mockReturnValue(nowMs);

    await reconcileMorningBriefingDeliverySchedule.handler(ctx, {});

    expect(rows).toEqual(
      expectedSlots.map((slot, index) => ({
        _id: `slot_${index}`,
        ...slot,
        status: 'scheduled'
      }))
    );
    expect(scheduler.runAt).toHaveBeenCalledTimes(expectedSlots.length);
    expect(scheduler.runAt).toHaveBeenCalledWith(expectedSlots[0]?.scheduledAt, scheduleStoreMocks.scheduledDelivery, {
      scheduleSlotKey: expectedSlots[0]?.key,
      localDate: expectedSlots[0]?.localDate,
      slot: expectedSlots[0]?.slot,
      scheduledAt: expectedSlots[0]?.scheduledAt
    });

    scheduler.runAt.mockClear();
    db.insert.mockClear();
    await reconcileMorningBriefingDeliverySchedule.handler(ctx, {});

    expect(db.insert).not.toHaveBeenCalled();
    expect(scheduler.runAt).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('does not recreate completed slots and records terminal outcomes', async () => {
    const nowMs = Date.parse('2026-06-11T21:00:00.000Z');
    const completedSlot = upcomingBriefingDeliverySlots({
      nowMs,
      timeZone: 'Australia/Sydney',
      horizonMs: 48 * 60 * 60 * 1000
    })[0];
    if (!completedSlot) throw new Error('Expected a future briefing delivery slot');
    const { reconcileMorningBriefingDeliverySchedule, completeBriefingDeliveryScheduleSlot } =
      (await import('./deliveryScheduleStore')) as unknown as {
        reconcileMorningBriefingDeliverySchedule: {
          handler: (ctx: ReturnType<typeof createContext>['ctx'], args: Record<string, never>) => Promise<unknown>;
        };
        completeBriefingDeliveryScheduleSlot: {
          handler: (
            ctx: ReturnType<typeof createContext>['ctx'],
            args: { key: string; completedAt: number; outcome: 'completed' | 'failed' }
          ) => Promise<unknown>;
        };
      };
    const { ctx, rows, scheduler } = createContext([
      { _id: 'completed_slot', ...completedSlot, status: 'completed', completedAt: nowMs }
    ]);
    vi.spyOn(Date, 'now').mockReturnValue(nowMs);

    await reconcileMorningBriefingDeliverySchedule.handler(ctx, {});

    expect(rows.filter((row) => row.key === completedSlot.key)).toEqual([
      { _id: 'completed_slot', ...completedSlot, status: 'completed', completedAt: nowMs }
    ]);
    expect(scheduler.runAt).not.toHaveBeenCalledWith(
      completedSlot.scheduledAt,
      scheduleStoreMocks.scheduledDelivery,
      expect.anything()
    );

    const scheduledRow = rows.find((row) => row.status === 'scheduled');
    if (!scheduledRow) throw new Error('Expected another scheduled briefing delivery slot');
    await completeBriefingDeliveryScheduleSlot.handler(ctx, {
      key: scheduledRow.key,
      completedAt: nowMs + 1,
      outcome: 'failed'
    });

    expect(scheduledRow).toMatchObject({ status: 'failed', completedAt: nowMs + 1 });
    vi.restoreAllMocks();
  });
});
