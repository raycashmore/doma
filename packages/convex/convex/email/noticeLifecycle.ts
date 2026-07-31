import { calendarDateInTimeZone, isCalendarDate, shiftCalendarDate, zonedCalendarDateTimeMs } from '../calendarDate';

export type EmailNoticeDateConfidence = 'low' | 'medium' | 'high';

export type EmailNoticeRelevance = {
  relevantThrough: string | null;
  dateConfidence: EmailNoticeDateConfidence;
  dateEvidence: string;
};

export type EmailNoticeLifecycleObligation = {
  dueOn: string;
  dueDateConfidence: EmailNoticeDateConfidence;
  dueDateEvidence: string;
};

export const emailNoticeTimeZone = 'Australia/Sydney';

function isGrounded(date: string | null, confidence: EmailNoticeDateConfidence, evidence: string) {
  return date !== null && isCalendarDate(date) && confidence !== 'low' && evidence.trim().length > 0;
}

function startOfShiftedDay(localDate: string, days: number, timeZone: string) {
  return zonedCalendarDateTimeMs(shiftCalendarDate(localDate, days), 0, 0, timeZone);
}

export function emailNoticeExpiresAt({
  createdAt,
  obligation,
  relevance,
  timeZone = emailNoticeTimeZone
}: {
  createdAt: number;
  obligation: EmailNoticeLifecycleObligation | null;
  relevance: EmailNoticeRelevance;
  timeZone?: string;
}): number {
  const justifiedExpiries: number[] = [];
  if (obligation && isGrounded(obligation.dueOn, obligation.dueDateConfidence, obligation.dueDateEvidence)) {
    justifiedExpiries.push(startOfShiftedDay(obligation.dueOn, 2, timeZone));
  }
  if (
    relevance.relevantThrough &&
    isGrounded(relevance.relevantThrough, relevance.dateConfidence, relevance.dateEvidence)
  ) {
    justifiedExpiries.push(startOfShiftedDay(relevance.relevantThrough, 1, timeZone));
  }
  if (justifiedExpiries.length > 0) return Math.max(...justifiedExpiries);

  const createdOn = calendarDateInTimeZone(new Date(createdAt), timeZone);
  return startOfShiftedDay(createdOn, 14, timeZone);
}
