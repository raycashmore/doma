import { loadJsonlDataset } from './shared/dataset.ts';
import { runEvalCases } from './shared/grader.ts';
import { renderScorecard, summarizeEvalResults } from './shared/report.ts';

type DemoInput = {
  message: string;
};

type DemoExpectation = {
  capability: string;
};

const demoDataset = `
{"id":"route-briefing-001","input":{"message":"what do we need to remember today?"},"expect":{"capability":"briefing"},"metadata":{"risk":"medium"}}
{"id":"route-none-001","input":{"message":"thanks"},"expect":{"capability":"none"},"metadata":{"risk":"low"}}
`;

const cases = loadJsonlDataset<DemoInput, DemoExpectation>(demoDataset);
const results = await runEvalCases({
  cases,
  execute: async (testCase) => ({
    capability: testCase.expect.capability
  }),
  graders: [
    ({ testCase, output }) =>
      output.capability === testCase.expect.capability
        ? []
        : [
            {
              category: 'routing',
              message: `Expected ${testCase.expect.capability}, got ${output.capability}`,
              launchBlocking: true
            }
          ]
  ]
});

console.log(renderScorecard('Demo evals', summarizeEvalResults(results)));
