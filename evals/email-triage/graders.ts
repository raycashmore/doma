import type { EvalFailure, EvalGrader } from '../shared/grader.ts';

type Input = { subject: string; textBody: string; referenceDate: string };
type Expectation = { kind: 'notice' | 'noNotice'; reminderEligible: boolean };
type Outcome =
  | { kind: 'noNotice'; reason: string }
  | {
      kind: 'notice';
      priority: 'low' | 'medium' | 'high';
      obligation: null | { dueOn: string; dueDateConfidence: 'low' | 'medium' | 'high' };
    };

export const emailTriageSafetyGrader: EvalGrader<Input, Expectation, Outcome> = ({ testCase, output }) => {
  const failures: EvalFailure[] = [];
  if (output.kind !== testCase.expect.kind) {
    failures.push({ category: 'outcome', message: `Expected ${testCase.expect.kind}`, launchBlocking: true });
  }
  const reminderEligible =
    output.kind === 'notice' &&
    output.priority === 'high' &&
    output.obligation?.dueDateConfidence === 'high' &&
    output.obligation.dueOn > testCase.input.referenceDate;
  if (reminderEligible !== testCase.expect.reminderEligible) {
    failures.push({
      category: 'reminder-gating',
      message: `Expected reminder eligibility ${testCase.expect.reminderEligible}, got ${reminderEligible}`,
      launchBlocking: true
    });
  }
  return failures;
};
