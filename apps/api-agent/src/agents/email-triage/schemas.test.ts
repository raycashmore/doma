import { describe, expect, it } from 'vitest';

import { emailTriageOutcomeFromModel } from './schemas.js';

describe('emailTriageOutcomeFromModel', () => {
  it('preserves the Home notice contract and a typed obligation', () => {
    expect(
      emailTriageOutcomeFromModel({
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
    ).toEqual({
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
      }
    });
  });

  it('reduces a no-notice result to its quiet reason', () => {
    expect(
      emailTriageOutcomeFromModel({
        outcome: 'noNotice',
        category: 'other',
        priority: 'low',
        title: '',
        body: '',
        extractedFacts: [],
        reason: 'Marketing content with no household action.',
        obligation: null
      })
    ).toEqual({ kind: 'noNotice', reason: 'Marketing content with no household action.' });
  });

  it('rejects impossible calendar dates rather than scheduling them', () => {
    expect(() =>
      emailTriageOutcomeFromModel({
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
        }
      })
    ).toThrow();
  });

  it('rejects a notice without visible title or body content', () => {
    expect(() =>
      emailTriageOutcomeFromModel({
        outcome: 'notice',
        category: 'other',
        priority: 'medium',
        title: '',
        body: '',
        extractedFacts: [],
        reason: '',
        obligation: null
      })
    ).toThrow();
  });
});
