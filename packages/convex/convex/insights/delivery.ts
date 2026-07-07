import { monthLabelFromKey } from './assembly';

export type SpendingInsightForDelivery = {
  monthKey: string;
  headline: string;
  observations: string[];
  prediction: string;
};

export type SpendingInsightDeliveryAttemptStatus = 'pending' | SpendingInsightDeliveryStatus;
export type SpendingInsightDeliveryStatus = 'sent' | 'skipped' | 'failed';

export type SpendingInsightDeliveryAttempt = {
  monthKey: string;
  recipientUserId: string;
  attemptedAt?: number;
  status?: SpendingInsightDeliveryAttemptStatus;
};

export type SpendingInsightDeliveryCounts = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
};

export type SpendingInsightNotificationSender = (notification: {
  recipientUserId: string;
  topic: 'insights.spending';
  message: string;
  metadata: Record<string, string>;
}) => Promise<{ status: SpendingInsightDeliveryStatus; errorCode?: string }>;

export type SpendingInsightDeliveryAttemptRecorder = (attempt: {
  monthKey: string;
  recipientUserId: string;
  attemptedAt: number;
  status: SpendingInsightDeliveryAttemptStatus;
  providerErrorCode?: string;
}) => Promise<{ claimed?: boolean } | unknown>;

export const spendingInsightDeliveryPendingLeaseMs = 15 * 60 * 1000;

export function formatSpendingInsightMessage(insight: SpendingInsightForDelivery) {
  return [
    `Spending insight — ${monthLabelFromKey(insight.monthKey)}`,
    '',
    insight.headline.trim(),
    '',
    ...insight.observations.map((observation) => `- ${observation.trim()}`),
    '',
    `Next month: ${insight.prediction.trim()}`
  ].join('\n');
}

export async function runSpendingInsightDeliveryCycle({
  nowMs,
  insights,
  attempts,
  recipientUserIds,
  sendNotification,
  recordDeliveryAttempt
}: {
  nowMs: number;
  insights: SpendingInsightForDelivery[];
  attempts: SpendingInsightDeliveryAttempt[];
  recipientUserIds: string[];
  sendNotification: SpendingInsightNotificationSender;
  recordDeliveryAttempt: SpendingInsightDeliveryAttemptRecorder;
}): Promise<SpendingInsightDeliveryCounts> {
  const counts: SpendingInsightDeliveryCounts = { processed: 0, sent: 0, skipped: 0, failed: 0 };
  if (recipientUserIds.length === 0) return counts;

  for (const insight of insights) {
    const completedRecipients = new Set(
      attempts
        .filter(
          (attempt) =>
            attempt.monthKey === insight.monthKey && (attempt.status === 'sent' || attempt.status === 'skipped')
        )
        .map((attempt) => attempt.recipientUserId)
    );
    const pendingRecipientUserIds = recipientUserIds.filter(
      (recipientUserId) => !completedRecipients.has(recipientUserId)
    );
    if (pendingRecipientUserIds.length === 0) continue;

    const message = formatSpendingInsightMessage(insight);

    for (const recipientUserId of pendingRecipientUserIds) {
      const claimResult = await recordDeliveryAttempt({
        monthKey: insight.monthKey,
        recipientUserId,
        attemptedAt: nowMs,
        status: 'pending'
      });

      if (typeof claimResult === 'object' && claimResult !== null && 'claimed' in claimResult && !claimResult.claimed) {
        continue;
      }

      const result = await sendNotification({
        recipientUserId,
        topic: 'insights.spending',
        message,
        metadata: {
          monthKey: insight.monthKey
        }
      });

      await recordDeliveryAttempt({
        monthKey: insight.monthKey,
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
