import { describe, expect, it } from 'vitest';

import { emailTriageModelOutputSchema, emailTriageOutcomeFromModel } from './schemas.js';

const modelNotice = {
  outcome: 'notice' as const,
  category: 'school' as const,
  priority: 'high' as const,
  title: 'Return permission form',
  body: 'The permission form is due next week.',
  extractedFacts: [{ label: 'Due', value: '2026-07-31' }],
  reason: '',
  obligation: {
    action: 'Return the permission form',
    dueOn: '2026-07-31',
    dueDateConfidence: 'high' as const,
    dueDateEvidence: 'due Friday 31 July'
  },
  relevance: {
    relevantThrough: '2026-08-02',
    dateConfidence: 'high' as const,
    dateEvidence: 'The event is on 2 August.'
  },
  supersession: {
    noticeId: 'email_old',
    confidence: 'high' as const,
    evidence: 'This replaces the previous event time.'
  }
};

const invalidLifecycleNotice = {
  ...modelNotice,
  relevance: {
    relevantThrough: '2026-02-30',
    dateConfidence: 'high' as const,
    dateEvidence: 'The event is on 30 February.'
  },
  supersession: {
    noticeId: 'email_unsupplied',
    confidence: 'high' as const,
    evidence: 'This replaces a notice not in context.'
  }
};

describe('emailTriageOutcomeFromModel', () => {
  it('preserves the Home notice contract and a typed obligation', () => {
    expect(emailTriageOutcomeFromModel(modelNotice, new Set(['email_old']))).toEqual({
      kind: 'notice',
      category: 'school',
      priority: 'high',
      title: 'Return permission form',
      body: 'The permission form is due next week.',
      extractedFacts: [{ label: 'Due', value: '2026-07-31' }],
      obligation: {
        action: 'Return the permission form',
        dueOn: '2026-07-31',
        dueDateConfidence: 'high',
        dueDateEvidence: 'due Friday 31 July'
      },
      relevance: {
        relevantThrough: '2026-08-02',
        dateConfidence: 'high',
        dateEvidence: 'The event is on 2 August.'
      },
      supersession: {
        noticeId: 'email_old',
        confidence: 'high',
        evidence: 'This replaces the previous event time.'
      }
    });
  });

  it('keeps a grounded relevance date and high-confidence supplied replacement', () => {
    expect(emailTriageOutcomeFromModel(modelNotice, new Set(['email_old']))).toMatchObject({
      kind: 'notice',
      relevance: {
        relevantThrough: '2026-08-02',
        dateConfidence: 'high'
      },
      supersession: {
        noticeId: 'email_old',
        confidence: 'high'
      }
    });
  });

  it('falls back when lifecycle metadata is invalid or targets an unsupplied notice', () => {
    expect(emailTriageOutcomeFromModel(invalidLifecycleNotice, new Set(['email_current']))).toMatchObject({
      kind: 'notice',
      relevance: {
        relevantThrough: null,
        dateConfidence: 'low',
        dateEvidence: ''
      },
      supersession: {
        noticeId: null,
        confidence: 'low',
        evidence: ''
      }
    });
  });

  it('requires complete lifecycle metadata from the model', () => {
    expect(() =>
      emailTriageModelOutputSchema.parse({
      outcome: 'notice',
      category: 'school',
      priority: 'high',
      title: 'Return permission form',
      body: 'The permission form is due next week.',
      extractedFacts: [{ label: 'Due', value: '2026-07-31' }],
      reason: '',
      obligation: {
        action: 'Return the permission form',
        dueOn: '2026-07-31',
        dueDateConfidence: 'high',
        dueDateEvidence: 'due Friday 31 July'
      }
      })
    ).toThrow();
  });

  it('rejects malformed lifecycle metadata from the model', () => {
    expect(() =>
      emailTriageModelOutputSchema.parse({
      ...modelNotice,
      relevance: {
        relevantThrough: 20_260_802,
        dateConfidence: 'certain',
        dateEvidence: { private: 'malformed relevance evidence' }
      },
      supersession: {
        noticeId: 123,
        confidence: false,
        evidence: ['malformed supersession evidence']
      }
      })
    ).toThrow();
  });

  it('reduces a no-notice result to its quiet reason', () => {
    expect(
      emailTriageOutcomeFromModel(
        {
          outcome: 'noNotice',
          category: 'other',
          priority: 'low',
          title: '',
          body: '',
          extractedFacts: [],
          reason: 'Marketing content with no household action.',
          obligation: null,
          relevance: { relevantThrough: '', dateConfidence: 'low', dateEvidence: '' },
          supersession: { noticeId: '', confidence: 'low', evidence: '' }
        },
        new Set()
      )
    ).toEqual({ kind: 'noNotice', reason: 'Marketing content with no household action.' });
  });

  it('rejects impossible calendar dates rather than scheduling them', () => {
    expect(() =>
      emailTriageOutcomeFromModel(
        {
          outcome: 'notice',
          category: 'admin',
          priority: 'high',
          title: 'Submit form',
          body: 'A form needs attention.',
          extractedFacts: [],
          reason: '',
          obligation: {
            action: 'Submit the form',
            dueOn: '2026-02-30',
            dueDateConfidence: 'high',
            dueDateEvidence: '30 February'
          },
          relevance: { relevantThrough: '', dateConfidence: 'low', dateEvidence: '' },
          supersession: { noticeId: '', confidence: 'low', evidence: '' }
        },
        new Set()
      )
    ).toThrow();
  });

  it('rejects a notice without visible title or body content', () => {
    expect(() =>
      emailTriageOutcomeFromModel(
        {
          outcome: 'notice',
          category: 'other',
          priority: 'medium',
          title: '',
          body: '',
          extractedFacts: [],
          reason: '',
          obligation: null,
          relevance: { relevantThrough: '', dateConfidence: 'low', dateEvidence: '' },
          supersession: { noticeId: '', confidence: 'low', evidence: '' }
        },
        new Set()
      )
    ).toThrow();
  });
});
