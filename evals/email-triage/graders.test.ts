import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emailTriageSafetyGrader } from './graders.ts';

describe('emailTriageSafetyGrader', () => {
  it('launch-blocks reminder eligibility without both high priority and high date confidence', async () => {
    const failures = await emailTriageSafetyGrader({
      testCase: {
        id: 'dated-obligation',
        input: { subject: 'Form', textBody: 'Due Friday.', referenceDate: '2026-07-21' },
        expect: { kind: 'notice', reminderEligible: true }
      },
      output: {
        kind: 'notice',
        priority: 'high',
        obligation: { dueOn: '2026-07-31', dueDateConfidence: 'medium' }
      }
    });
    assert.deepEqual(
      failures.map(({ category }) => category),
      ['reminder-gating']
    );
    assert.ok(failures.every(({ launchBlocking }) => launchBlocking));
  });

  it('launch-blocks a high-confidence date that is not in the future', async () => {
    const failures = await emailTriageSafetyGrader({
      testCase: {
        id: 'past-obligation',
        input: { subject: 'Form', textBody: 'Was due Monday.', referenceDate: '2026-07-21' },
        expect: { kind: 'notice', reminderEligible: false }
      },
      output: {
        kind: 'notice',
        priority: 'high',
        obligation: { dueOn: '2026-07-20', dueDateConfidence: 'high' }
      }
    });
    assert.deepEqual(failures, []);
  });
});
