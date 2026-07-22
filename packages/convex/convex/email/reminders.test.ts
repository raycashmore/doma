import { describe, expect, it } from 'vitest';

import { reminderCandidateForNotice } from './reminders';

const notice = {
  noticeId: 'emailNotices_123',
  capturedEmailId: 'capturedEmails_123',
  priority: 'high' as const,
  obligation: {
    action: 'Submit the permission form',
    dueOn: '2026-07-31',
    dueDateConfidence: 'high' as const,
    dueDateEvidence: 'The form is due 31 July.'
  },
  triageRunId: 'email_run_123'
};

describe('reminderCandidateForNotice', () => {
  it('schedules a high-confidence high-priority obligation for 7pm Sydney time the day before', () => {
    expect(
      reminderCandidateForNotice(notice, {
        processedAt: Date.parse('2026-07-21T02:00:00.000Z')
      })
    ).toEqual({
      noticeId: 'emailNotices_123',
      capturedEmailId: 'capturedEmails_123',
      action: 'Submit the permission form',
      dueOn: '2026-07-31',
      reminderAt: Date.parse('2026-07-30T09:00:00.000Z'),
      triageRunId: 'email_run_123',
      createdAt: Date.parse('2026-07-21T02:00:00.000Z')
    });
  });

  it('uses the daylight-saving offset on the local reminder date', () => {
    expect(
      reminderCandidateForNotice(
        {
          ...notice,
          obligation: { ...notice.obligation, dueOn: '2026-10-05' }
        },
        { processedAt: Date.parse('2026-09-20T02:00:00.000Z') }
      )?.reminderAt
    ).toBe(Date.parse('2026-10-04T08:00:00.000Z'));
  });

  it.each([
    ['medium priority', { priority: 'medium' as const }],
    ['medium date confidence', { obligation: { ...notice.obligation, dueDateConfidence: 'medium' as const } }],
    ['a due date that is not in the future', { obligation: { ...notice.obligation, dueOn: '2026-07-21' } }]
  ])('does not schedule %s', (_label, override) => {
    expect(
      reminderCandidateForNotice({ ...notice, ...override }, { processedAt: Date.parse('2026-07-21T02:00:00.000Z') })
    ).toBeNull();
  });
});
