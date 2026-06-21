import { z } from 'zod';

function parseAppOrigin(value: string, ctx: z.RefinementCtx) {
  try {
    const url = new URL(value);

    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      url.username !== '' ||
      url.password !== ''
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'APP_ORIGIN must be an HTTP(S) origin'
      });

      return z.NEVER;
    }

    return url.origin;
  } catch {
    ctx.addIssue({
      code: 'custom',
      message: 'APP_ORIGIN must be an HTTP(S) origin'
    });

    return z.NEVER;
  }
}

const botConfigSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  BOT_SERVICE_TOKEN: z.string().min(1),
  CONVEX_URL: z.string().url().optional(),
  SCHEDULE_CAPABILITY_URL: z.string().url().optional(),
  SCHEDULE_CAPABILITY_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  LISTS_CAPABILITY_URL: z.string().url().optional(),
  LISTS_CAPABILITY_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  OPENAI_API_KEY: z.string().min(1).optional(),
  INTENT_ROUTER_AI_MODEL: z.string().min(1).optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z
    .string()
    .regex(/^[A-Za-z0-9_]{5,32}$/)
    .regex(/bot$/i),
  UPSTASH_REDIS_REST_URL: z.string().url().startsWith('https://'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  APP_ORIGIN: z.string().min(1).transform(parseAppOrigin)
});

export type BotConfig = {
  clerkSecretKey: string;
  clerkPublishableKey: string;
  botServiceToken: string;
  convexUrl?: string;
  scheduleCapabilityUrl?: string;
  scheduleCapabilityTimeoutMs: number;
  listsCapabilityUrl?: string;
  listsCapabilityTimeoutMs: number;
  openAiApiKey?: string;
  intentRouterAiModel?: string;
  pairingEnabled: boolean;
  telegramBotToken: string;
  telegramWebhookSecret: string;
  telegramBotUsername: string;
  upstashRedisRestUrl: string;
  upstashRedisRestToken: string;
  appOrigin: string;
};

export function parseConfig(env: Record<string, unknown>): BotConfig {
  const result = botConfigSchema.safeParse(env);

  if (!result.success) {
    throw new Error('Invalid bot gateway config');
  }

  return {
    clerkSecretKey: result.data.CLERK_SECRET_KEY,
    clerkPublishableKey: result.data.CLERK_PUBLISHABLE_KEY,
    botServiceToken: result.data.BOT_SERVICE_TOKEN,
    convexUrl: result.data.CONVEX_URL,
    scheduleCapabilityUrl: result.data.SCHEDULE_CAPABILITY_URL,
    scheduleCapabilityTimeoutMs: result.data.SCHEDULE_CAPABILITY_TIMEOUT_MS,
    listsCapabilityUrl: result.data.LISTS_CAPABILITY_URL,
    listsCapabilityTimeoutMs: result.data.LISTS_CAPABILITY_TIMEOUT_MS,
    openAiApiKey: result.data.OPENAI_API_KEY,
    intentRouterAiModel: result.data.INTENT_ROUTER_AI_MODEL,
    pairingEnabled: result.data.VERCEL_ENV === 'production',
    telegramBotToken: result.data.TELEGRAM_BOT_TOKEN,
    telegramWebhookSecret: result.data.TELEGRAM_WEBHOOK_SECRET,
    telegramBotUsername: result.data.TELEGRAM_BOT_USERNAME,
    upstashRedisRestUrl: result.data.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: result.data.UPSTASH_REDIS_REST_TOKEN,
    appOrigin: result.data.APP_ORIGIN
  };
}

export function getConfig() {
  return parseConfig(process.env);
}
