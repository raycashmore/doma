import { describe, expect, it, vi } from 'vitest';

import {
  formatSpendingInsightMessage,
  runSpendingInsightDeliveryCycle,
  type SpendingInsightForDelivery
} from './delivery';

const insight = {
  monthKey: '2026-06',
  headline: 'Grocery spend has crept up for a third straight month',
  observations: ['Groceries rose again while dining out fell', 'Subscriptions held flat despite the annual renewal'],
  prediction: 'Expect grocery spend to level off as the winter promotions end.'
} satisfies SpendingInsightForDelivery;

describe('formatSpendingInsightMessage', () => {
  it('formats the headline and observations as short, separated Telegram paragraphs without the website forecast', () => {
    expect(formatSpendingInsightMessage(insight)).toBe(
      [
        'Grocery spend has crept up for a third straight month',
        '',
        'Groceries rose again while dining out fell',
        '',
        'Subscriptions held flat despite the annual renewal'
      ].join('\n')
    );
  });
});

describe('runSpendingInsightDeliveryCycle', () => {
  it('sends an undelivered insight to every recipient and records attempts', async () => {
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runSpendingInsightDeliveryCycle({
        nowMs: Date.parse('2026-07-02T09:00:00.000Z'),
        insights: [insight],
        attempts: [],
        recipientUserIds: ['household-user-1', 'household-user-2'],
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({
      processed: 2,
      sent: 2,
      skipped: 0,
      failed: 0
    });

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'household-user-1',
      topic: 'insights.spending',
      message: formatSpendingInsightMessage(insight),
      metadata: {
        monthKey: '2026-06'
      }
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      monthKey: '2026-06',
      recipientUserId: 'household-user-1',
      attemptedAt: Date.parse('2026-07-02T09:00:00.000Z'),
      status: 'pending'
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      monthKey: '2026-06',
      recipientUserId: 'household-user-1',
      attemptedAt: Date.parse('2026-07-02T09:00:00.000Z'),
      status: 'sent'
    });
  });

  it('does not re-send an insight to recipients who already received it', async () => {
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runSpendingInsightDeliveryCycle({
        nowMs: Date.parse('2026-07-02T09:00:00.000Z'),
        insights: [insight],
        attempts: [
          { monthKey: '2026-06', recipientUserId: 'household-user-1', status: 'sent' },
          { monthKey: '2026-06', recipientUserId: 'household-user-2', status: 'skipped' }
        ],
        recipientUserIds: ['household-user-1', 'household-user-2'],
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0
    });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordDeliveryAttempt).not.toHaveBeenCalled();
  });

  it('retries recipients whose previous attempt failed and records the provider error', async () => {
    const sendNotification = vi.fn(async () => ({ status: 'failed' as const, errorCode: 'telegram_error' }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runSpendingInsightDeliveryCycle({
        nowMs: Date.parse('2026-07-02T21:00:00.000Z'),
        insights: [insight],
        attempts: [{ monthKey: '2026-06', recipientUserId: 'household-user-1', status: 'failed' }],
        recipientUserIds: ['household-user-1'],
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({
      processed: 1,
      sent: 0,
      skipped: 0,
      failed: 1
    });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(recordDeliveryAttempt).toHaveBeenLastCalledWith({
      monthKey: '2026-06',
      recipientUserId: 'household-user-1',
      attemptedAt: Date.parse('2026-07-02T21:00:00.000Z'),
      status: 'failed',
      providerErrorCode: 'telegram_error'
    });
  });

  it('skips a recipient when another runner already claimed the delivery', async () => {
    const sendNotification = vi.fn();
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: false as const }));

    await expect(
      runSpendingInsightDeliveryCycle({
        nowMs: Date.parse('2026-07-02T09:00:00.000Z'),
        insights: [insight],
        attempts: [],
        recipientUserIds: ['household-user-1'],
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });
});
