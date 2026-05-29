import { z } from 'zod';

const botConfigSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  BOT_SERVICE_TOKEN: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().min(1),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  APP_ORIGIN: z.string().min(1),
});

export interface BotConfig {
  clerkSecretKey: string;
  clerkPublishableKey: string;
  botServiceToken: string;
  telegramBotToken: string;
  telegramWebhookSecret: string;
  telegramBotUsername: string;
  upstashRedisRestUrl: string;
  upstashRedisRestToken: string;
  appOrigin: string;
}

export function parseConfig(env: Record<string, unknown>): BotConfig {
  const result = botConfigSchema.safeParse(env);

  if (!result.success) {
    throw new Error('Invalid bot gateway config');
  }

  return {
    clerkSecretKey: result.data.CLERK_SECRET_KEY,
    clerkPublishableKey: result.data.CLERK_PUBLISHABLE_KEY,
    botServiceToken: result.data.BOT_SERVICE_TOKEN,
    telegramBotToken: result.data.TELEGRAM_BOT_TOKEN,
    telegramWebhookSecret: result.data.TELEGRAM_WEBHOOK_SECRET,
    telegramBotUsername: result.data.TELEGRAM_BOT_USERNAME,
    upstashRedisRestUrl: result.data.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: result.data.UPSTASH_REDIS_REST_TOKEN,
    appOrigin: result.data.APP_ORIGIN,
  };
}

export function getConfig() {
  return parseConfig(process.env);
}
