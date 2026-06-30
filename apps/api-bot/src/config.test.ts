import { describe, expect, it } from 'vitest';

import { parseConfig } from './config.js';

const validEnv = {
  CLERK_SECRET_KEY: 'clerk-secret-key',
  CLERK_PUBLISHABLE_KEY: 'clerk-publishable-key',
  BOT_SERVICE_TOKEN: 'service-token',
  CONVEX_URL: 'https://convex.example.com',
  TELEGRAM_BOT_TOKEN: 'telegram-bot-token',
  TELEGRAM_WEBHOOK_SECRET: 'telegram-webhook-secret',
  TELEGRAM_BOT_USERNAME: 'doma_bot',
  UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
  APP_ORIGIN: 'https://app.example.com'
};

describe('parseConfig', () => {
  it('maps required environment variables to bot config', () => {
    expect(parseConfig(validEnv)).toEqual({
      clerkSecretKey: 'clerk-secret-key',
      clerkPublishableKey: 'clerk-publishable-key',
      botServiceToken: 'service-token',
      convexUrl: 'https://convex.example.com',
      scheduleCapabilityUrl: undefined,
      scheduleCapabilityTimeoutMs: 15_000,
      listsCapabilityUrl: undefined,
      listsCapabilityTimeoutMs: 15_000,
      forwardedEmailAllowedSenders: [],
      resendApiKey: undefined,
      resendWebhookSecret: undefined,
      openAiApiKey: undefined,
      intentRouterAiModel: undefined,
      intentRouterAiTimeoutMs: 10_000,
      pairingEnabled: false,
      telegramBotToken: 'telegram-bot-token',
      telegramWebhookSecret: 'telegram-webhook-secret',
      telegramBotUsername: 'doma_bot',
      upstashRedisRestUrl: 'https://upstash.example.com',
      upstashRedisRestToken: 'upstash-token',
      appOrigin: 'https://app.example.com'
    });
  });

  it('enables pairing in production deployments', () => {
    expect(parseConfig({ ...validEnv, VERCEL_ENV: 'production' }).pairingEnabled).toBe(true);
  });

  it('normalizes a localhost app origin without changing the port', () => {
    expect(parseConfig({ ...validEnv, APP_ORIGIN: 'http://localhost:3000' }).appOrigin).toBe('http://localhost:3000');
  });

  it('accepts an optional schedule capability URL', () => {
    expect(
      parseConfig({
        ...validEnv,
        SCHEDULE_CAPABILITY_URL: 'https://schedule.example.com/schedule/api/bot/schedule'
      }).scheduleCapabilityUrl
    ).toBe('https://schedule.example.com/schedule/api/bot/schedule');
  });

  it('accepts an optional lists capability URL', () => {
    expect(
      parseConfig({
        ...validEnv,
        LISTS_CAPABILITY_URL: 'https://lists.example.com/api/bot/lists'
      }).listsCapabilityUrl
    ).toBe('https://lists.example.com/api/bot/lists');
  });

  it('accepts optional forwarded email allowed senders', () => {
    expect(
      parseConfig({
        ...validEnv,
        FORWARDED_EMAIL_ALLOWED_SENDERS: ' forwarder@example.com, member@example.com '
      }).forwardedEmailAllowedSenders
    ).toEqual(['forwarder@example.com', 'member@example.com']);
  });

  it('accepts optional Resend webhook and API credentials', () => {
    const config = parseConfig({
      ...validEnv,
      RESEND_API_KEY: 'resend-api-key',
      RESEND_WEBHOOK_SECRET: 'resend-webhook-secret'
    });

    expect(config.resendApiKey).toBe('resend-api-key');
    expect(config.resendWebhookSecret).toBe('resend-webhook-secret');
  });

  it('accepts an optional positive lists capability timeout', () => {
    expect(parseConfig({ ...validEnv, LISTS_CAPABILITY_TIMEOUT_MS: '20000' }).listsCapabilityTimeoutMs).toBe(20_000);
  });

  it('accepts an optional positive schedule capability timeout', () => {
    expect(parseConfig({ ...validEnv, SCHEDULE_CAPABILITY_TIMEOUT_MS: '20000' }).scheduleCapabilityTimeoutMs).toBe(
      20_000
    );
  });

  it('accepts the optional intent router LLM access for the gateway', () => {
    const config = parseConfig({
      ...validEnv,
      OPENAI_API_KEY: 'openai-key',
      INTENT_ROUTER_AI_MODEL: 'intent-model'
    });

    expect(config.openAiApiKey).toBe('openai-key');
    expect(config.intentRouterAiModel).toBe('intent-model');
  });

  it('accepts an optional positive intent router AI timeout', () => {
    expect(parseConfig({ ...validEnv, INTENT_ROUTER_AI_TIMEOUT_MS: '20000' }).intentRouterAiTimeoutMs).toBe(20_000);
  });

  it('throws a stable config error when the intent router AI timeout is invalid', () => {
    expect(() => parseConfig({ ...validEnv, INTENT_ROUTER_AI_TIMEOUT_MS: '0' })).toThrow(
      new Error('Invalid bot gateway config')
    );
  });

  it('throws a stable config error when the schedule capability timeout is invalid', () => {
    expect(() => parseConfig({ ...validEnv, SCHEDULE_CAPABILITY_TIMEOUT_MS: '0' })).toThrow(
      new Error('Invalid bot gateway config')
    );
  });

  it('throws a stable config error when the schedule capability URL is invalid', () => {
    expect(() => parseConfig({ ...validEnv, SCHEDULE_CAPABILITY_URL: 'not-a-url' })).toThrow(
      new Error('Invalid bot gateway config')
    );
  });

  it('does not require the unused Convex URL', () => {
    const env: Record<string, string> = { ...validEnv };
    delete env.CONVEX_URL;

    expect(parseConfig(env).convexUrl).toBeUndefined();
  });

  it('normalizes an app origin with a trailing slash', () => {
    expect(parseConfig({ ...validEnv, APP_ORIGIN: 'https://app.example.com/' }).appOrigin).toBe(
      'https://app.example.com'
    );
  });

  it('throws a stable config error when required values are missing', () => {
    const env: Record<string, string> = { ...validEnv };
    delete env.BOT_SERVICE_TOKEN;

    expect(() => parseConfig(env)).toThrow(new Error('Invalid bot gateway config'));
  });

  it('throws a stable config error when the Upstash Redis REST URL is invalid', () => {
    expect(() => parseConfig({ ...validEnv, UPSTASH_REDIS_REST_URL: 'not-a-url' })).toThrow(
      new Error('Invalid bot gateway config')
    );
  });

  it('accepts an HTTPS Upstash Redis REST URL', () => {
    expect(
      parseConfig({
        ...validEnv,
        UPSTASH_REDIS_REST_URL: 'https://upstash.example.com'
      }).upstashRedisRestUrl
    ).toBe('https://upstash.example.com');
  });

  it.each([
    ['FTP', 'ftp://upstash.example.com'],
    ['HTTP', 'http://upstash.example.com']
  ])('throws a stable config error for a non-HTTPS %s Upstash URL', (_scheme, value) => {
    expect(() => parseConfig({ ...validEnv, UPSTASH_REDIS_REST_URL: value })).toThrow(
      new Error('Invalid bot gateway config')
    );
  });

  it.each([
    ['path', 'https://app.example.com/dashboard'],
    ['query', 'https://app.example.com?next=/dashboard'],
    ['hash', 'https://app.example.com#dashboard'],
    ['invalid', 'not-a-url'],
    ['empty', '']
  ])('throws a stable config error for an app origin with %s', (_case, value) => {
    expect(() => parseConfig({ ...validEnv, APP_ORIGIN: value })).toThrow(new Error('Invalid bot gateway config'));
  });

  it.each([
    ['too short', 'bot'],
    ['too long', 'a'.repeat(30) + 'bot'],
    ['invalid character', 'doma-bot'],
    ['leading at-sign', '@doma_bot'],
    ['missing bot suffix', 'doma_assistant']
  ])('throws a stable config error for a Telegram bot username that is %s', (_case, value) => {
    expect(() => parseConfig({ ...validEnv, TELEGRAM_BOT_USERNAME: value })).toThrow(
      new Error('Invalid bot gateway config')
    );
  });
});
