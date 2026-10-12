import { describe, expect, it } from 'vitest';

import { parseConfig } from './config.js';

const requiredEnv = {
  AGENT_SERVICE_TOKEN: 'test-service-token',
  APP_ORIGIN: 'https://example.com',
  CLERK_PUBLISHABLE_KEY: 'test-publishable-key',
  CLERK_SECRET_KEY: 'test-secret-key',
  CONVEX_URL: 'https://example.convex.cloud'
};

describe('email triage model configuration', () => {
  it('defaults to GPT-5 mini', () => {
    expect(parseConfig(requiredEnv).emailTriageModel).toBe('openai/gpt-5-mini');
  });

  it('allows an environment override', () => {
    expect(
      parseConfig({ ...requiredEnv, FORWARDED_EMAIL_TRIAGE_AI_MODEL: 'google/gemini-2.5-flash' }).emailTriageModel
    ).toBe('google/gemini-2.5-flash');
  });
});
