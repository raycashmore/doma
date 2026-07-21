import { describe, expect, it, vi } from 'vitest';

import { formatEmailReminderMessage, runEmailReminderDeliveryCycle } from './delivery';

const reminder = {
  id: 'emailReminderCandidates_123',
  noticeId: 'emailNotices_123',
  capturedEmailId: 'capturedEmails_123',
  action: 'Submit the permission form',
  dueOn: '2026-07-31',
  reminderAt: Date.parse('2026-07-30T09:00:00.000Z')
};

describe('email reminder delivery', () => {
  it('formats the deterministic day-before message', () => {
    expect(formatEmailReminderMessage(reminder)).toBe('Tomorrow: Submit the permission form\nDue Friday, 31 July.');
  });

  it('sends and records a reminder once for each recipient', async () => {
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true }));
    await expect(
      runEmailReminderDeliveryCycle({
        nowMs: reminder.reminderAt,
        reminders: [reminder],
        attempts: [],
        recipientUserIds: ['user_123'],
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_123',
      topic: 'email.reminder',
      message: 'Tomorrow: Submit the permission form\nDue Friday, 31 July.',
      metadata: {
        reminderId: 'emailReminderCandidates_123',
        noticeId: 'emailNotices_123',
        capturedEmailId: 'capturedEmails_123',
        dueOn: '2026-07-31'
      }
    });
  });

  it('does not replay a sent reminder', async () => {
    const sendNotification = vi.fn();
    await runEmailReminderDeliveryCycle({
      nowMs: reminder.reminderAt,
      reminders: [reminder],
      attempts: [{ reminderId: reminder.id, recipientUserId: 'user_123', status: 'sent' }],
      recipientUserIds: ['user_123'],
      sendNotification,
      recordDeliveryAttempt: vi.fn()
    });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
