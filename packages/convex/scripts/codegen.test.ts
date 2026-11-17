import { describe, expect, it } from 'vitest';

import { codegenEnv } from './codegen';

const local = { CONVEX_DEPLOYMENT: 'local:local-sample' };

describe('codegenEnv', () => {
  it('pins the CLI to the local deployment from the env file', () => {
    expect(codegenEnv(local, { CONVEX_DEPLOYMENT: 'dev:sample-deployment', PATH: '/bin' })).toEqual({
      CONVEX_DEPLOYMENT: 'local:local-sample',
      PATH: '/bin'
    });
  });

  it.each([['dev:sample-deployment'], ['prod:sample-deployment']])('refuses %s', (deployment) => {
    expect(() => codegenEnv({ CONVEX_DEPLOYMENT: deployment }, {})).toThrow(/not a local deployment/);
  });

  it('refuses when no deployment is set', () => {
    expect(() => codegenEnv({}, {})).toThrow(/unset/);
  });

  it('refuses when a deploy key in the shell would override the local deployment', () => {
    expect(() => codegenEnv(local, { CONVEX_DEPLOY_KEY: 'sample' })).toThrow(/CONVEX_DEPLOY_KEY/);
  });

  it('refuses when the env file names a self-hosted backend', () => {
    expect(() => codegenEnv({ ...local, CONVEX_SELF_HOSTED_URL: 'https://convex.example.test' }, {})).toThrow(
      /CONVEX_SELF_HOSTED_URL/
    );
  });
});
