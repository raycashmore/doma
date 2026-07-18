import { z } from 'zod';

const configSchema = z.object({
  AGENT_SERVICE_TOKEN: z.string().min(1),
  APP_ORIGIN: z.string().url(),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CONVEX_URL: z.string().url(),
  WEEKLY_MEALS_AI_MODEL: z.string().min(1).default('openai/gpt-5.4-mini')
});

export type AgentConfig = {
  agentServiceToken: string;
  appOrigin: string;
  clerkPublishableKey: string;
  clerkSecretKey: string;
  convexUrl: string;
  weeklyMealsModel: string;
};

export function parseConfig(env: Record<string, unknown>): AgentConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) throw new Error('Invalid agent service config');
  return {
    agentServiceToken: result.data.AGENT_SERVICE_TOKEN,
    appOrigin: new URL(result.data.APP_ORIGIN).origin,
    clerkPublishableKey: result.data.CLERK_PUBLISHABLE_KEY,
    clerkSecretKey: result.data.CLERK_SECRET_KEY,
    convexUrl: result.data.CONVEX_URL,
    weeklyMealsModel: result.data.WEEKLY_MEALS_AI_MODEL
  };
}

export function getConfig() {
  return parseConfig(process.env);
}
