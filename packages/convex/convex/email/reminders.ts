import { calendarDateInTimeZone, shiftCalendarDate, zonedCalendarDateTimeMs } from '../calendarDate';

export const forwardedEmailTimeZone = 'Australia/Sydney';

type ReminderNotice = {
  noticeId: string;
  capturedEmailId: string;
  priority: 'low' | 'medium' | 'high';
  obligation: {
    action: string;
    dueOn: string;
    dueDateConfidence: 'low' | 'medium' | 'high';
    dueDateEvidence: string;
  } | null;
  triageRunId: string;
};

export function reminderCandidateForNotice(
  notice: ReminderNotice,
  { processedAt, timeZone = forwardedEmailTimeZone }: { processedAt: number; timeZone?: string }
) {
  const obligation = notice.obligation;
  if (
    notice.priority !== 'high' ||
    obligation?.dueDateConfidence !== 'high' ||
    obligation.dueOn <= calendarDateInTimeZone(new Date(processedAt), timeZone)
  ) {
    return null;
  }

  return {
    noticeId: notice.noticeId,
    capturedEmailId: notice.capturedEmailId,
    action: obligation.action,
    dueOn: obligation.dueOn,
    reminderAt: zonedCalendarDateTimeMs(shiftCalendarDate(obligation.dueOn, -1), 19, 0, timeZone),
    triageRunId: notice.triageRunId,
    createdAt: processedAt
  };
}
