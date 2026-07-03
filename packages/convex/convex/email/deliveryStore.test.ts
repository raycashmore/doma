import { describe, expect, it } from 'vitest';

import { emailNoticeDeliveryPendingLeaseMs } from './delivery';
import { selectEmailNoticeDeliveryAttemptWrite } from './deliveryStore';

const nowMs = Date.parse('2026-07-03T08:30:00.000Z');

describe('selectEmailNoticeDeliveryAttemptWrite', () => {
  it('reclaims a stale pending delivery attempt', () => {
    const stalePendingAttempt = {
      _id: 'attempts_stale',
      noticeId: 'emailNotices_123',
      recipientUserId: 'notice-user-1',
      attemptedAt: nowMs - emailNoticeDeliveryPendingLeaseMs - 1,
      status: 'pending' as const
    };

    expect(
      selectEmailNoticeDeliveryAttemptWrite({
        existingAttempts: [stalePendingAttempt],
        attempt: {
          noticeId: 'emailNotices_123',
          recipientUserId: 'notice-user-1',
          attemptedAt: nowMs,
          status: 'pending'
        }
      })
    ).toEqual({
      operation: 'patch',
      claimed: true,
      id: 'attempts_stale'
    });
  });

  it('keeps a fresh pending delivery attempt claimed by another runner', () => {
    const freshPendingAttempt = {
      _id: 'attempts_fresh',
      noticeId: 'emailNotices_123',
      recipientUserId: 'notice-user-1',
      attemptedAt: nowMs - emailNoticeDeliveryPendingLeaseMs + 1,
      status: 'pending' as const
    };

    expect(
      selectEmailNoticeDeliveryAttemptWrite({
        existingAttempts: [freshPendingAttempt],
        attempt: {
          noticeId: 'emailNotices_123',
          recipientUserId: 'notice-user-1',
          attemptedAt: nowMs,
          status: 'pending'
        }
      })
    ).toEqual({
      operation: 'skip',
      claimed: false,
      id: 'attempts_fresh'
    });
  });
});
