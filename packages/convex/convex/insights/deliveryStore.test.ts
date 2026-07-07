import { describe, expect, it } from 'vitest';

import { spendingInsightDeliveryPendingLeaseMs } from './delivery';
import { latestSpendingInsightForDelivery, selectSpendingInsightDeliveryAttemptWrite } from './deliveryStore';

const nowMs = Date.parse('2026-07-02T09:00:00.000Z');

describe('latestSpendingInsightForDelivery', () => {
  it('selects only the most recent month so historical insights are never delivered late', () => {
    const juneInsight = {
      monthKey: '2026-06',
      headline: 'June headline',
      observations: ['June observation'],
      prediction: 'June prediction',
      _creationTime: nowMs - 60_000
    };

    expect(
      latestSpendingInsightForDelivery([
        {
          monthKey: '2026-04',
          headline: 'April headline',
          observations: ['April observation'],
          prediction: 'April prediction',
          _creationTime: nowMs - 30_000
        },
        juneInsight,
        {
          monthKey: '2026-05',
          headline: 'May headline',
          observations: ['May observation'],
          prediction: 'May prediction',
          _creationTime: nowMs - 90_000
        }
      ])
    ).toEqual(juneInsight);
  });

  it('returns null when no insight is stored', () => {
    expect(latestSpendingInsightForDelivery([])).toBeNull();
  });
});

describe('selectSpendingInsightDeliveryAttemptWrite', () => {
  it('claims a first delivery attempt by inserting it', () => {
    expect(
      selectSpendingInsightDeliveryAttemptWrite({
        existingAttempts: [],
        attempt: {
          monthKey: '2026-06',
          recipientUserId: 'household-user-1',
          attemptedAt: nowMs,
          status: 'pending'
        }
      })
    ).toEqual({
      operation: 'insert',
      claimed: true
    });
  });

  it('keeps a fresh pending delivery attempt claimed by another runner', () => {
    expect(
      selectSpendingInsightDeliveryAttemptWrite({
        existingAttempts: [
          {
            _id: 'attempts_fresh',
            monthKey: '2026-06',
            recipientUserId: 'household-user-1',
            attemptedAt: nowMs - spendingInsightDeliveryPendingLeaseMs + 1,
            status: 'pending' as const
          }
        ],
        attempt: {
          monthKey: '2026-06',
          recipientUserId: 'household-user-1',
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

  it('reclaims a stale pending delivery attempt by patching it', () => {
    expect(
      selectSpendingInsightDeliveryAttemptWrite({
        existingAttempts: [
          {
            _id: 'attempts_stale',
            monthKey: '2026-06',
            recipientUserId: 'household-user-1',
            attemptedAt: nowMs - spendingInsightDeliveryPendingLeaseMs - 1,
            status: 'pending' as const
          }
        ],
        attempt: {
          monthKey: '2026-06',
          recipientUserId: 'household-user-1',
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

  it('never re-claims a delivery that was already sent', () => {
    expect(
      selectSpendingInsightDeliveryAttemptWrite({
        existingAttempts: [
          {
            _id: 'attempts_sent',
            monthKey: '2026-06',
            recipientUserId: 'household-user-1',
            attemptedAt: nowMs - 60_000,
            status: 'sent' as const
          }
        ],
        attempt: {
          monthKey: '2026-06',
          recipientUserId: 'household-user-1',
          attemptedAt: nowMs,
          status: 'pending'
        }
      })
    ).toEqual({
      operation: 'skip',
      claimed: false,
      id: 'attempts_sent'
    });
  });
});
