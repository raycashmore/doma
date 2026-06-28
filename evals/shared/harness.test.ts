import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadJsonlDataset } from './dataset.ts';
import { runEvalCases, type EvalFailure } from './grader.ts';
import { renderScorecard, summarizeEvalResults } from './report.ts';

describe('loadJsonlDataset', () => {
  it('loads stable case ids, inputs, expectations, and metadata from JSONL', () => {
    const cases = loadJsonlDataset<{ message: string }, { capability: string }>(`
{"id":"route-briefing-001","input":{"message":"what do we need to remember today?"},"expect":{"capability":"briefing"},"metadata":{"risk":"medium"}}

{"id":"route-none-001","input":{"message":"thanks"},"expect":{"capability":"none"}}
`);

    assert.deepEqual(cases, [
      {
        id: 'route-briefing-001',
        input: { message: 'what do we need to remember today?' },
        expect: { capability: 'briefing' },
        metadata: { risk: 'medium' }
      },
      {
        id: 'route-none-001',
        input: { message: 'thanks' },
        expect: { capability: 'none' }
      }
    ]);
  });
});

describe('runEvalCases', () => {
  it('records pass/fail status, failure category, message, and launch-blocking flag', async () => {
    const cases = loadJsonlDataset<{ expected: string }, { expected: string }>(`
{"id":"case-pass","input":{"expected":"briefing"},"expect":{"expected":"briefing"}}
{"id":"case-fail","input":{"expected":"lists"},"expect":{"expected":"briefing"}}
`);

    const results = await runEvalCases({
      cases,
      execute: async (testCase) => ({ actual: testCase.input.expected }),
      graders: [
        ({ testCase, output }): EvalFailure[] =>
          output.actual === testCase.expect.expected
            ? []
            : [
                {
                  category: 'routing',
                  message: `Expected ${testCase.expect.expected}, got ${output.actual}`,
                  launchBlocking: true
                }
              ]
      ]
    });

    assert.deepEqual(results, [
      { caseId: 'case-pass', status: 'pass', failures: [] },
      {
        caseId: 'case-fail',
        status: 'fail',
        failures: [
          {
            category: 'routing',
            message: 'Expected briefing, got lists',
            launchBlocking: true
          }
        ]
      }
    ]);
  });
});

describe('renderScorecard', () => {
  it('summarizes pass rate, grouped failure counts, launch blockers, and failing case ids', () => {
    const summary = summarizeEvalResults([
      { caseId: 'case-pass', status: 'pass', failures: [] },
      {
        caseId: 'case-fail-a',
        status: 'fail',
        failures: [{ category: 'routing', message: 'Wrong capability', launchBlocking: true }]
      },
      {
        caseId: 'case-fail-b',
        status: 'fail',
        failures: [{ category: 'privacy', message: 'Private label leaked', launchBlocking: false }]
      }
    ]);

    assert.equal(
      renderScorecard('Intent router evals', summary),
      `Intent router evals
Cases: 3
Passed: 1
Failed: 2
Pass rate: 33.3%
Launch blockers: 1

Failures by category:
- privacy: 1
- routing: 1

Failing cases:
- case-fail-a
- case-fail-b`
    );
  });
});
