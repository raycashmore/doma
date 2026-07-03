import { describe, expect, it, vi } from 'vitest';

import { type EmailNoticeForDelivery, formatEmailNoticeMessage, runEmailNoticeDeliveryCycle } from './delivery';

const notice = {
  id: 'emailNotices_123',
  capturedEmailId: 'capturedEmails_123',
  category: 'school',
  priority: 'medium',
  title: 'Bring library bag',
  body: 'Bring a library bag tomorrow.',
  extractedFacts: [{ label: 'item', value: 'library bag' }],
  telegramWorthy: true,
  createdAt: Date.parse('2026-07-03T08:20:00.000Z')
} satisfies EmailNoticeForDelivery;

describe('formatEmailNoticeMessage', () => {
  it('formats a plain-text notice with extracted facts', () => {
    expect(formatEmailNoticeMessage(notice)).toBe(
      ['Bring library bag', 'Bring a library bag tomorrow.', '', 'Details:', '- item: library bag'].join('\n')
    );
  });
});

describe('runEmailNoticeDeliveryCycle', () => {
  it('sends Telegram-worthy notices to notice-specific recipients and records attempts', async () => {
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runEmailNoticeDeliveryCycle({
        nowMs: Date.parse('2026-07-03T08:30:00.000Z'),
        notices: [notice],
        attempts: [],
        recipientUserIds: ['notice-user-1'],
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({
      processed: 1,
      sent: 1,
      skipped: 0,
      failed: 0
    });

    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'notice-user-1',
      topic: 'email.notice',
      message: ['Bring library bag', 'Bring a library bag tomorrow.', '', 'Details:', '- item: library bag'].join('\n'),
      metadata: {
        noticeId: 'emailNotices_123',
        capturedEmailId: 'capturedEmails_123',
        category: 'school',
        priority: 'medium'
      }
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      noticeId: 'emailNotices_123',
      recipientUserId: 'notice-user-1',
      attemptedAt: Date.parse('2026-07-03T08:30:00.000Z'),
      status: 'pending'
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      noticeId: 'emailNotices_123',
      recipientUserId: 'notice-user-1',
      attemptedAt: Date.parse('2026-07-03T08:30:00.000Z'),
      status: 'sent'
    });
  });

  it('does not send board-only notices', async () => {
    const sendNotification = vi.fn();
    const recordDeliveryAttempt = vi.fn();

    await expect(
      runEmailNoticeDeliveryCycle({
        nowMs: Date.parse('2026-07-03T08:30:00.000Z'),
        notices: [{ ...notice, telegramWorthy: false }],
        attempts: [],
        recipientUserIds: ['notice-user-1'],
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

  it('records unlinked recipients as skipped from the bot gateway result', async () => {
    const sendNotification = vi.fn(async () => ({ status: 'skipped' as const, errorCode: 'no_linked_channel' }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runEmailNoticeDeliveryCycle({
        nowMs: Date.parse('2026-07-03T08:30:00.000Z'),
        notices: [notice],
        attempts: [],
        recipientUserIds: ['notice-user-1'],
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({
      processed: 1,
      sent: 0,
      skipped: 1,
      failed: 0
    });

    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      noticeId: 'emailNotices_123',
      recipientUserId: 'notice-user-1',
      attemptedAt: Date.parse('2026-07-03T08:30:00.000Z'),
      status: 'skipped',
      providerErrorCode: 'no_linked_channel'
    });
  });

  it('records provider failures without creating extra attempts', async () => {
    const sendNotification = vi.fn(async () => ({ status: 'failed' as const, errorCode: 'telegram_error' }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runEmailNoticeDeliveryCycle({
        nowMs: Date.parse('2026-07-03T08:30:00.000Z'),
        notices: [notice],
        attempts: [],
        recipientUserIds: ['notice-user-1'],
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({
      processed: 1,
      sent: 0,
      skipped: 0,
      failed: 1
    });

    expect(recordDeliveryAttempt).toHaveBeenCalledTimes(2);
    expect(recordDeliveryAttempt).toHaveBeenLastCalledWith({
      noticeId: 'emailNotices_123',
      recipientUserId: 'notice-user-1',
      attemptedAt: Date.parse('2026-07-03T08:30:00.000Z'),
      status: 'failed',
      providerErrorCode: 'telegram_error'
    });
  });

  it('does not duplicate successful deliveries on replay', async () => {
    const sendNotification = vi.fn();
    const recordDeliveryAttempt = vi.fn();

    await expect(
      runEmailNoticeDeliveryCycle({
        nowMs: Date.parse('2026-07-03T08:30:00.000Z'),
        notices: [notice],
        attempts: [
          {
            noticeId: 'emailNotices_123',
            recipientUserId: 'notice-user-1',
            status: 'sent'
          }
        ],
        recipientUserIds: ['notice-user-1'],
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

  it('skips a delivery when another runner already claimed the notice recipient', async () => {
    const sendNotification = vi.fn();
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: false as const }));

    await expect(
      runEmailNoticeDeliveryCycle({
        nowMs: Date.parse('2026-07-03T08:30:00.000Z'),
        notices: [notice],
        attempts: [],
        recipientUserIds: ['notice-user-1'],
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
