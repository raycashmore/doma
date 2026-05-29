import { describe, expect, it } from 'vitest';
import { parseConfig } from './config.js';

const validEnv = {
  CLERK_SECRET_KEY: 'clerk-secret-key',
  CLERK_PUBLISHABLE_KEY: 'clerk-publishable-key',
  BOT_SERVICE_TOKEN: 'service-token',
  TELEGRAM_BOT_TOKEN: 'telegram-bot-token',
  TELEGRAM_WEBHOOK_SECRET: 'telegram-webhook-secret',
  TELEGRAM_BOT_USERNAME: 'doma_bot',
  UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
  APP_ORIGIN: 'https://app.example.com',
};

describe('parseConfig', () => {
  it('maps required environment variables to bot config', () => {
    expect(parseConfig(validEnv)).toEqual({
      clerkSecretKey: 'clerk-secret-key',
      clerkPublishableKey: 'clerk-publishable-key',
      botServiceToken: 'service-token',
      telegramBotToken: 'telegram-bot-token',
      telegramWebhookSecret: 'telegram-webhook-secret',
      telegramBotUsername: 'doma_bot',
      upstashRedisRestUrl: 'https://upstash.example.com',
      upstashRedisRestToken: 'upstash-token',
      appOrigin: 'https://app.example.com',
    });
  });

  it('normalizes a localhost app origin without changing the port', () => {
    expect(
      parseConfig({ ...validEnv, APP_ORIGIN: 'http://localhost:3000' })
        .appOrigin
    ).toBe('http://localhost:3000');
  });

  it('normalizes an app origin with a trailing slash', () => {
    expect(
      parseConfig({ ...validEnv, APP_ORIGIN: 'https://app.example.com/' })
        .appOrigin
    ).toBe('https://app.example.com');
  });

  it('throws a stable config error when required values are missing', () => {
    const env: Record<string, string> = { ...validEnv };
    delete env.BOT_SERVICE_TOKEN;

    expect(() => parseConfig(env)).toThrow(
      new Error('Invalid bot gateway config')
    );
  });

  it.each([
    ['path', 'https://app.example.com/dashboard'],
    ['query', 'https://app.example.com?next=/dashboard'],
    ['hash', 'https://app.example.com#dashboard'],
    ['invalid', 'not-a-url'],
    ['empty', ''],
  ])('throws a stable config error for an app origin with %s', (_case, value) => {
    expect(() =>
      parseConfig({ ...validEnv, APP_ORIGIN: value })
    ).toThrow(new Error('Invalid bot gateway config'));
  });
});
