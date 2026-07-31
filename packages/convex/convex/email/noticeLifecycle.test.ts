import { describe, expect, it } from 'vitest';

import { emailNoticeExpiresAt } from './noticeLifecycle';

const noRelevance = {
  relevantThrough: null,
  dateConfidence: 'low' as const,
  dateEvidence: ''
};

describe('emailNoticeExpiresAt', () => {
  it('keeps a dated obligation for one full overdue Sydney calendar day', () => {
    expect(
      emailNoticeExpiresAt({
        createdAt: Date.parse('2026-07-21T02:00:00.000Z'),
        obligation: {
          dueOn: '2026-07-31',
          dueDateConfidence: 'high',
          dueDateEvidence: 'The form is due 31 July.'
        },
        relevance: noRelevance
      })
    ).toBe(Date.parse('2026-08-01T14:00:00.000Z'));
  });

  it('expires other grounded information after its relevant-through date', () => {
    expect(
      emailNoticeExpiresAt({
        createdAt: Date.parse('2026-07-21T02:00:00.000Z'),
        obligation: null,
        relevance: {
          relevantThrough: '2026-08-02',
          dateConfidence: 'medium',
          dateEvidence: 'The temporary arrangement applies through 2 August.'
        }
      })
    ).toBe(Date.parse('2026-08-02T14:00:00.000Z'));
  });

  it('uses the later justified expiry when a notice contains two useful dates', () => {
    expect(
      emailNoticeExpiresAt({
        createdAt: Date.parse('2026-07-21T02:00:00.000Z'),
        obligation: {
          dueOn: '2026-07-25',
          dueDateConfidence: 'high',
          dueDateEvidence: 'Reply by 25 July.'
        },
        relevance: {
          relevantThrough: '2026-08-02',
          dateConfidence: 'high',
          dateEvidence: 'The event occurs on 2 August.'
        }
      })
    ).toBe(Date.parse('2026-08-02T14:00:00.000Z'));
  });

  it('falls back to fourteen household dates when no date is trustworthy', () => {
    expect(
      emailNoticeExpiresAt({
        createdAt: Date.parse('2026-07-21T02:00:00.000Z'),
        obligation: null,
        relevance: {
          relevantThrough: '2026-08-02',
          dateConfidence: 'low',
          dateEvidence: 'The date may be relevant.'
        }
      })
    ).toBe(Date.parse('2026-08-03T14:00:00.000Z'));
  });

  it('falls back when an obligation date is not a valid calendar date', () => {
    expect(
      emailNoticeExpiresAt({
        createdAt: Date.parse('2026-07-21T02:00:00.000Z'),
        obligation: {
          dueOn: '2026-02-30',
          dueDateConfidence: 'high',
          dueDateEvidence: 'The form is due on the stated date.'
        },
        relevance: noRelevance
      })
    ).toBe(Date.parse('2026-08-03T14:00:00.000Z'));
  });

  it('falls back when relevance has only whitespace date evidence', () => {
    expect(
      emailNoticeExpiresAt({
        createdAt: Date.parse('2026-07-21T02:00:00.000Z'),
        obligation: null,
        relevance: {
          relevantThrough: '2026-08-02',
          dateConfidence: 'high',
          dateEvidence: '   '
        }
      })
    ).toBe(Date.parse('2026-08-03T14:00:00.000Z'));
  });

  it('uses Sydney midnight across the daylight-saving transition', () => {
    expect(
      emailNoticeExpiresAt({
        createdAt: Date.parse('2026-09-30T02:00:00.000Z'),
        obligation: {
          dueOn: '2026-10-03',
          dueDateConfidence: 'high',
          dueDateEvidence: 'The action is due 3 October.'
        },
        relevance: noRelevance
      })
    ).toBe(Date.parse('2026-10-04T13:00:00.000Z'));
  });
});
