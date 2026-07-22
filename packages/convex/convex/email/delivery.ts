export type EmailReminderForDelivery = {
  id: string;
  noticeId: string;
  capturedEmailId: string;
  action: string;
  dueOn: string;
  reminderAt: number;
};

export type EmailReminderDeliveryAttemptStatus = 'pending' | 'sent' | 'skipped' | 'failed';
export type EmailReminderDeliveryAttempt = {
  reminderId: string;
  recipientUserId: string;
  attemptedAt?: number;
  status?: EmailReminderDeliveryAttemptStatus;
};

export const emailReminderDeliveryPendingLeaseMs = 15 * 60 * 1000;

export function formatEmailReminderMessage(reminder: EmailReminderForDelivery) {
  const date = new Date(`${reminder.dueOn}T00:00:00.000Z`);
  const weekday = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC',
    weekday: 'long'
  }).format(date);
  const dayAndMonth = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long'
  }).format(date);
  return `Tomorrow: ${reminder.action.trim()}\nDue ${weekday}, ${dayAndMonth}.`;
}

export async function runEmailReminderDeliveryCycle({
  nowMs,
  reminders,
  attempts,
  recipientUserIds,
  sendNotification,
  recordDeliveryAttempt
}: {
  nowMs: number;
  reminders: EmailReminderForDelivery[];
  attempts: EmailReminderDeliveryAttempt[];
  recipientUserIds: string[];
  sendNotification: (notification: {
    recipientUserId: string;
    topic: 'email.reminder';
    message: string;
    metadata: Record<string, string>;
  }) => Promise<{ status: 'sent' | 'skipped' | 'failed'; errorCode?: string }>;
  recordDeliveryAttempt: (attempt: {
    reminderId: string;
    recipientUserId: string;
    attemptedAt: number;
    status: EmailReminderDeliveryAttemptStatus;
    providerErrorCode?: string;
  }) => Promise<{ claimed?: boolean } | unknown>;
}) {
  const counts = { processed: 0, sent: 0, skipped: 0, failed: 0 };
  for (const reminder of reminders) {
    const completed = new Set(
      attempts
        .filter(
          (attempt) => attempt.reminderId === reminder.id && (attempt.status === 'sent' || attempt.status === 'skipped')
        )
        .map((attempt) => attempt.recipientUserId)
    );
    for (const recipientUserId of recipientUserIds.filter((id) => !completed.has(id))) {
      const claim = await recordDeliveryAttempt({
        reminderId: reminder.id,
        recipientUserId,
        attemptedAt: nowMs,
        status: 'pending'
      });
      if (typeof claim === 'object' && claim !== null && 'claimed' in claim && !claim.claimed) continue;
      const result = await sendNotification({
        recipientUserId,
        topic: 'email.reminder',
        message: formatEmailReminderMessage(reminder),
        metadata: {
          reminderId: reminder.id,
          noticeId: reminder.noticeId,
          capturedEmailId: reminder.capturedEmailId,
          dueOn: reminder.dueOn
        }
      });
      await recordDeliveryAttempt({
        reminderId: reminder.id,
        recipientUserId,
        attemptedAt: nowMs,
        status: result.status,
        ...(result.errorCode ? { providerErrorCode: result.errorCode } : {})
      });
      counts.processed += 1;
      counts[result.status] += 1;
    }
  }
  return counts;
}
