import { v } from 'convex/values';

import { internalMutation, internalQuery } from '../_generated/server';
import { zonedCalendarDateTimeMs } from '../calendarDate';
import { type EmailReminderDeliveryAttemptStatus, emailReminderDeliveryPendingLeaseMs } from './delivery';
import { forwardedEmailTimeZone } from './reminders';

type StoredAttempt<TId extends string = string> = {
  _id: TId;
  reminderId: string;
  recipientUserId: string;
  attemptedAt: number;
  status: EmailReminderDeliveryAttemptStatus;
};

type AttemptWrite = Omit<StoredAttempt, '_id'> & { providerErrorCode?: string };

export function isEmailReminderDeliverable({
  nowMs,
  reminder,
  notice,
  isArchivedOnHome
}: {
  nowMs: number;
  reminder: { dueOn: string };
  notice: { archivedAt?: number; expiresAt?: number; supersededAt?: number } | null;
  isArchivedOnHome: boolean;
}) {
  return Boolean(
    notice &&
    notice.archivedAt === undefined &&
    notice.supersededAt === undefined &&
    (notice.expiresAt === undefined || notice.expiresAt > nowMs) &&
    !isArchivedOnHome &&
    nowMs < zonedCalendarDateTimeMs(reminder.dueOn, 0, 0, forwardedEmailTimeZone)
  );
}

export function selectEmailReminderDeliveryAttemptWrite<TId extends string>({
  existingAttempts,
  attempt
}: {
  existingAttempts: StoredAttempt<TId>[];
  attempt: AttemptWrite;
}) {
  const terminal = existingAttempts.find((item) => item.status === 'sent' || item.status === 'skipped');
  const pending = existingAttempts.find((item) => item.status === 'pending');
  if (terminal) return { operation: 'skip' as const, claimed: false as const, id: terminal._id };
  if (
    attempt.status === 'pending' &&
    pending &&
    attempt.attemptedAt - pending.attemptedAt < emailReminderDeliveryPendingLeaseMs
  ) {
    return { operation: 'skip' as const, claimed: false as const, id: pending._id };
  }
  const retryable = pending ?? existingAttempts[0];
  return retryable
    ? { operation: 'patch' as const, claimed: true as const, id: retryable._id }
    : { operation: 'insert' as const, claimed: true as const };
}

export const emailReminderDeliveryRunInputs = internalQuery({
  args: { nowMs: v.number() },
  handler: async (ctx, { nowMs }) => {
    const due = await ctx.db
      .query('emailReminderCandidates')
      .withIndex('by_reminder_at', (q) => q.gte('reminderAt', nowMs - 48 * 60 * 60 * 1000).lte('reminderAt', nowMs))
      .collect();
    const reminders = [];
    for (const reminder of due) {
      const notice = await ctx.db.get(reminder.noticeId);
      const archives = await ctx.db
        .query('boardArchives')
        .withIndex('by_occurrence_id', (q) => q.eq('occurrenceId', `emailNotice:${reminder.noticeId}`))
        .collect();
      if (
        !isEmailReminderDeliverable({
          nowMs,
          reminder,
          notice,
          isArchivedOnHome: archives.some((archive) => archive.sourceKind === 'forwardedEmail')
        })
      ) {
        continue;
      }
      reminders.push({
        id: reminder._id,
        noticeId: reminder.noticeId,
        capturedEmailId: reminder.capturedEmailId,
        action: reminder.action,
        dueOn: reminder.dueOn,
        reminderAt: reminder.reminderAt
      });
    }
    const activeIds = new Set(reminders.map((reminder) => reminder.id));
    const attempts = (await ctx.db.query('emailReminderDeliveryAttempts').collect()).filter((attempt) =>
      activeIds.has(attempt.reminderId)
    );
    return { reminders, attempts };
  }
});

export const recordEmailReminderDeliveryAttempt = internalMutation({
  args: {
    reminderId: v.id('emailReminderCandidates'),
    recipientUserId: v.string(),
    attemptedAt: v.number(),
    status: v.union(v.literal('pending'), v.literal('sent'), v.literal('skipped'), v.literal('failed')),
    providerErrorCode: v.optional(v.string())
  },
  handler: async (ctx, attempt) => {
    if (attempt.status === 'pending') {
      const reminder = await ctx.db.get(attempt.reminderId);
      if (!reminder) return { claimed: false as const };
      const notice = await ctx.db.get(reminder.noticeId);
      const archives = await ctx.db
        .query('boardArchives')
        .withIndex('by_occurrence_id', (q) => q.eq('occurrenceId', `emailNotice:${reminder.noticeId}`))
        .collect();
      if (
        !isEmailReminderDeliverable({
          nowMs: attempt.attemptedAt,
          reminder,
          notice,
          isArchivedOnHome: archives.some((archive) => archive.sourceKind === 'forwardedEmail')
        })
      ) {
        return { claimed: false as const };
      }
    }
    const existingAttempts = await ctx.db
      .query('emailReminderDeliveryAttempts')
      .withIndex('by_reminder_recipient', (q) =>
        q.eq('reminderId', attempt.reminderId).eq('recipientUserId', attempt.recipientUserId)
      )
      .collect();
    const decision = selectEmailReminderDeliveryAttemptWrite({ existingAttempts, attempt });
    if (decision.operation === 'skip') return { claimed: false as const, id: decision.id };
    if (decision.operation === 'patch') {
      await ctx.db.patch(decision.id, attempt);
      return { claimed: true as const, id: decision.id };
    }
    const id = await ctx.db.insert('emailReminderDeliveryAttempts', attempt);
    return { claimed: true as const, id };
  }
});
