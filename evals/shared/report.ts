import type { EvalResult } from './grader.ts';

export type EvalSummary = {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  launchBlockers: number;
  failuresByCategory: Record<string, number>;
  failingCaseIds: string[];
};

export function summarizeEvalResults(results: EvalResult[]): EvalSummary {
  const failuresByCategory: Record<string, number> = {};
  let launchBlockers = 0;
  const failingCaseIds: string[] = [];

  for (const result of results) {
    if (result.status === 'fail') failingCaseIds.push(result.caseId);
    for (const failure of result.failures) {
      failuresByCategory[failure.category] = (failuresByCategory[failure.category] ?? 0) + 1;
      if (failure.launchBlocking) launchBlockers += 1;
    }
  }

  const passed = results.filter((result) => result.status === 'pass').length;
  const failed = results.length - passed;
  return {
    total: results.length,
    passed,
    failed,
    passRate: results.length === 0 ? 0 : passed / results.length,
    launchBlockers,
    failuresByCategory,
    failingCaseIds
  };
}

export function renderScorecard(title: string, summary: EvalSummary): string {
  return [
    title,
    `Cases: ${summary.total}`,
    `Passed: ${summary.passed}`,
    `Failed: ${summary.failed}`,
    `Pass rate: ${(summary.passRate * 100).toFixed(1)}%`,
    `Launch blockers: ${summary.launchBlockers}`,
    '',
    'Failures by category:',
    ...renderCategoryLines(summary.failuresByCategory),
    '',
    'Failing cases:',
    ...renderFailingCases(summary.failingCaseIds)
  ].join('\n');
}

function renderCategoryLines(failuresByCategory: Record<string, number>) {
  const categories = Object.keys(failuresByCategory).sort();
  if (categories.length === 0) return ['- none'];
  return categories.map((category) => `- ${category}: ${failuresByCategory[category]}`);
}

function renderFailingCases(failingCaseIds: string[]) {
  if (failingCaseIds.length === 0) return ['- none'];
  return failingCaseIds.map((caseId) => `- ${caseId}`);
}
