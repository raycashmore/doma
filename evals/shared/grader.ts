import type { EvalCase } from './dataset.ts';

export type EvalFailure = {
  category: string;
  message: string;
  launchBlocking: boolean;
};

export type EvalResult = {
  caseId: string;
  status: 'pass' | 'fail';
  failures: EvalFailure[];
};

export type EvalGrader<TInput, TExpect, TOutput, TMetadata = Record<string, unknown>> = (args: {
  testCase: EvalCase<TInput, TExpect, TMetadata>;
  output: TOutput;
}) => EvalFailure[] | Promise<EvalFailure[]>;

export async function runEvalCases<TInput, TExpect, TOutput, TMetadata = Record<string, unknown>>({
  cases,
  execute,
  graders
}: {
  cases: EvalCase<TInput, TExpect, TMetadata>[];
  execute: (testCase: EvalCase<TInput, TExpect, TMetadata>) => TOutput | Promise<TOutput>;
  graders: EvalGrader<TInput, TExpect, TOutput, TMetadata>[];
}): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  for (const testCase of cases) {
    const output = await execute(testCase);
    const failures = (
      await Promise.all(graders.map((grader) => grader({ testCase, output })))
    ).flat();
    results.push({
      caseId: testCase.id,
      status: failures.length === 0 ? 'pass' : 'fail',
      failures
    });
  }
  return results;
}
