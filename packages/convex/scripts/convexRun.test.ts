import { describe, expect, it } from 'vitest';

import { cliEnv, targetDeployment } from './convexRun';

describe('targetDeployment', () => {
  it('uses the local deployment when no target is given', () => {
    expect(targetDeployment([])).toBeUndefined();
    expect(targetDeployment(['--'])).toBeUndefined();
  });

  it('takes the deployment name from a Convex cloud URL', () => {
    expect(targetDeployment(['--', 'https://example-name-123.convex.cloud'])).toBe('example-name-123');
    expect(targetDeployment(['https://example-name-123.convex.cloud/'])).toBe('example-name-123');
  });

  it('passes a deployment name or reference through', () => {
    expect(targetDeployment(['--', 'prod'])).toBe('prod');
    expect(targetDeployment(['example-name-123'])).toBe('example-name-123');
  });

  it('rejects any other URL', () => {
    expect(() => targetDeployment(['http://127.0.0.1:3210'])).toThrow(/convex\.cloud/);
    expect(() => targetDeployment(['https://example.com'])).toThrow(/convex\.cloud/);
  });
});

describe('cliEnv', () => {
  const env = { CONVEX_DEPLOYMENT: 'local:example', PATH: '/bin' };

  it('keeps the local deployment when no target is given', () => {
    expect(cliEnv(undefined, env)).toEqual(env);
  });

  it('drops the local deployment when a target is given', () => {
    expect(cliEnv('prod', env)).toEqual({ PATH: '/bin' });
  });
});
