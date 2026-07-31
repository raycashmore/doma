import { describe, expect, it } from 'vitest';

import { emailReminderDeliveryPendingLeaseMs } from './delivery';
import { isEmailReminderDeliverable, selectEmailReminderDeliveryAttemptWrite } from './deliveryStore';

describe('isEmailReminderDeliverable', () => {
  it('suppresses a pending reminder when its canonical Home occurrence was archived', () => {
    expect(
      isEmailReminderDeliverable({
        nowMs: Date.parse('2026-07-30T09:00:00.000Z'),
        reminder: { dueOn: '2026-07-31' },
        notice: {},
        isArchivedOnHome: true
      })
    ).toBe(false);
  });

  it('allows an active due reminder only before the local due date begins', () => {
    expect(
      isEmailReminderDeliverable({
        nowMs: Date.parse('2026-07-30T09:00:00.000Z'),
        reminder: { dueOn: '2026-07-31' },
        notice: {},
        isArchivedOnHome: false
      })
    ).toBe(true);
  });

  it('suppresses a reminder when the canonical notice expires at the delivery time', () => {
    expect(
      isEmailReminderDeliverable({
        nowMs: Date.parse('2026-07-30T09:00:00.000Z'),
        reminder: { dueOn: '2026-07-31' },
        notice: { expiresAt: Date.parse('2026-07-30T09:00:00.000Z') },
        isArchivedOnHome: false
      })
    ).toBe(false);
  });

  it('allows a reminder while the canonical notice expires after the delivery time', () => {
    expect(
      isEmailReminderDeliverable({
        nowMs: Date.parse('2026-07-30T09:00:00.000Z'),
        reminder: { dueOn: '2026-07-31' },
        notice: { expiresAt: Date.parse('2026-07-30T09:00:00.001Z') },
        isArchivedOnHome: false
      })
    ).toBe(true);
  });
});

describe('selectEmailReminderDeliveryAttemptWrite', () => {
  it('reclaims a stale pending attempt', () => {
    expect(
      selectEmailReminderDeliveryAttemptWrite({
        existingAttempts: [
          {
            _id: 'attempt_1',
            reminderId: 'reminder_1',
            recipientUserId: 'user_1',
            attemptedAt: 1,
            status: 'pending'
          }
        ],
        attempt: {
          reminderId: 'reminder_1',
          recipientUserId: 'user_1',
          attemptedAt: 1 + emailReminderDeliveryPendingLeaseMs,
          status: 'pending'
        }
      })
    ).toEqual({ operation: 'patch', claimed: true, id: 'attempt_1' });
  });

  it('never reclaims a sent reminder', () => {
    expect(
      selectEmailReminderDeliveryAttemptWrite({
        existingAttempts: [
          {
            _id: 'attempt_1',
            reminderId: 'reminder_1',
            recipientUserId: 'user_1',
            attemptedAt: 1,
            status: 'sent'
          }
        ],
        attempt: {
          reminderId: 'reminder_1',
          recipientUserId: 'user_1',
          attemptedAt: 999,
          status: 'pending'
        }
      })
    ).toEqual({ operation: 'skip', claimed: false, id: 'attempt_1' });
  });
});
