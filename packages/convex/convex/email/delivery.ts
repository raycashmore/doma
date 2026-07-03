export type EmailNoticeForDelivery = {
  id: string;
  capturedEmailId: string;
  category: string;
  priority: string;
  title: string;
  body: string;
  extractedFacts: Array<{
    label: string;
    value: string;
  }>;
  telegramWorthy: boolean;
  createdAt: number;
};

export type EmailNoticeDeliveryAttemptStatus = 'pending' | EmailNoticeDeliveryStatus;
export type EmailNoticeDeliveryStatus = 'sent' | 'skipped' | 'failed';

export type EmailNoticeDeliveryAttempt = {
  noticeId: string;
  recipientUserId: string;
  status?: EmailNoticeDeliveryAttemptStatus;
};

export type EmailNoticeDeliveryCounts = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
};

export type EmailNoticeNotificationSender = (notification: {
  recipientUserId: string;
  topic: 'email.notice';
  message: string;
  metadata: Record<string, string>;
}) => Promise<{ status: EmailNoticeDeliveryStatus; errorCode?: string }>;

export type EmailNoticeDeliveryAttemptRecorder = (attempt: {
  noticeId: string;
  recipientUserId: string;
  attemptedAt: number;
  status: EmailNoticeDeliveryAttemptStatus;
  providerErrorCode?: string;
}) => Promise<{ claimed?: boolean } | unknown>;

function emptyCounts(): EmailNoticeDeliveryCounts {
  return {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0
  };
}

function completedRecipientIds(attempts: EmailNoticeDeliveryAttempt[], noticeId: string) {
  return new Set(
    attempts
      .filter((attempt) => attempt.noticeId === noticeId && (attempt.status === 'sent' || attempt.status === 'skipped'))
      .map((attempt) => attempt.recipientUserId)
  );
}

export function formatEmailNoticeMessage(notice: EmailNoticeForDelivery) {
  const lines = [notice.title.trim(), notice.body.trim()].filter(Boolean);

  if (notice.extractedFacts.length > 0) {
    lines.push('', 'Details:');
    for (const fact of notice.extractedFacts) {
      lines.push(`- ${fact.label}: ${fact.value}`);
    }
  }

  return lines.join('\n');
}

export async function runEmailNoticeDeliveryCycle({
  nowMs,
  notices,
  attempts,
  recipientUserIds,
  sendNotification,
  recordDeliveryAttempt
}: {
  nowMs: number;
  notices: EmailNoticeForDelivery[];
  attempts: EmailNoticeDeliveryAttempt[];
  recipientUserIds: string[];
  sendNotification: EmailNoticeNotificationSender;
  recordDeliveryAttempt: EmailNoticeDeliveryAttemptRecorder;
}): Promise<EmailNoticeDeliveryCounts> {
  const counts = emptyCounts();
  if (recipientUserIds.length === 0) return counts;

  for (const notice of notices) {
    if (!notice.telegramWorthy) continue;

    const completedRecipients = completedRecipientIds(attempts, notice.id);
    const pendingRecipientUserIds = recipientUserIds.filter(
      (recipientUserId) => !completedRecipients.has(recipientUserId)
    );
    if (pendingRecipientUserIds.length === 0) continue;

    const message = formatEmailNoticeMessage(notice);
    if (message.trim().length === 0) continue;

    for (const recipientUserId of pendingRecipientUserIds) {
      const claimResult = await recordDeliveryAttempt({
        noticeId: notice.id,
        recipientUserId,
        attemptedAt: nowMs,
        status: 'pending'
      });

      if (typeof claimResult === 'object' && claimResult !== null && 'claimed' in claimResult && !claimResult.claimed) {
        continue;
      }

      const result = await sendNotification({
        recipientUserId,
        topic: 'email.notice',
        message,
        metadata: {
          noticeId: notice.id,
          capturedEmailId: notice.capturedEmailId,
          category: notice.category,
          priority: notice.priority
        }
      });

      await recordDeliveryAttempt({
        noticeId: notice.id,
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
