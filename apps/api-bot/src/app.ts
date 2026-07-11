import type { IncomingMessage, ServerResponse } from 'node:http';

import { Hono } from 'hono';

import { createConvexInsightsAnswer, createInsightsCapability } from './capabilities/insightsCapability.js';
import { createConvexMealPlanningCapability } from './capabilities/mealPlanningCapability.js';
import type { BotConfig } from './config.js';
import { getConfig } from './config.js';
import { createHttpCapability } from './dispatch/httpCapability.js';
import type { RouteClassifier } from './dispatch/router.js';
import type { CapabilityHandler } from './dispatch/types.js';
import { jsonOk } from './http/json.js';
import { createConvexForwardedEmailCapture } from './inbound-email/convexCapture.js';
import type { CaptureForwardedEmail } from './inbound-email/routes.js';
import { createInboundEmailRoutes } from './inbound-email/routes.js';
import { classifyIntent } from './intent/classifier.js';
import { createOpenAiIntentClassifierProvider } from './intent/openAiClassifier.js';
import { defaultIntentDescriptors } from './intent/registry.js';
import { createLinkingRoutes } from './linking/routes.js';
import { createNotificationRoutes } from './notifications/routes.js';
import { sendTelegramMessage, type TelegramMessageSender } from './providers/telegram/client.js';
import { createTelegramWebhookRoutes } from './providers/telegram/webhook.js';
import { type BotStorage, createRuntimeStorage } from './storage/index.js';

export type CreateAppOptions = {
  config?: BotConfig;
  storage?: BotStorage;
  capabilities?: Record<string, CapabilityHandler>;
  classify?: RouteClassifier;
  sendTelegramMessage?: TelegramMessageSender;
  captureForwardedEmail?: CaptureForwardedEmail;
};

let runtimeApp: BotApp | undefined;

function createRuntimeCapabilities(config: BotConfig): Record<string, CapabilityHandler> {
  const capabilities: Record<string, CapabilityHandler> = {};

  if (config.scheduleCapabilityUrl) {
    const scheduleCapability = createHttpCapability({
      endpointUrl: config.scheduleCapabilityUrl,
      serviceToken: config.botServiceToken,
      timeoutMs: config.scheduleCapabilityTimeoutMs
    });
    capabilities.briefing = scheduleCapability;
    capabilities.schedule = scheduleCapability;
  }

  if (config.listsCapabilityUrl) {
    // The LLM intent router classifies free-text messages to this capability.
    capabilities.lists = createHttpCapability({
      endpointUrl: config.listsCapabilityUrl,
      serviceToken: config.botServiceToken,
      timeoutMs: config.listsCapabilityTimeoutMs
    });
  }

  if (config.convexUrl) {
    // Runs in-process: the LLM intent router classifies spending insight
    // questions here, and the capability calls Convex directly for the
    // grounded answer.
    capabilities.insights = createInsightsCapability({
      answerQuestion: createConvexInsightsAnswer(config),
      timeoutMs: config.insightsCapabilityTimeoutMs
    });
    capabilities.meals = createConvexMealPlanningCapability(config);
  }

  return capabilities;
}

/**
 * Build the gateway's free-text intent router. The router runs inside api-bot
 * with direct LLM access (one hop, no Convex round-trip). When LLM access is not
 * configured, returns undefined so the dispatcher replies with a capabilities
 * hint rather than guessing.
 */
function createRuntimeClassifier(config: BotConfig): RouteClassifier | undefined {
  if (!config.openAiApiKey || !config.intentRouterAiModel) {
    return undefined;
  }

  const provider = createOpenAiIntentClassifierProvider({
    apiKey: config.openAiApiKey,
    model: config.intentRouterAiModel,
    descriptors: defaultIntentDescriptors,
    timeoutMs: config.intentRouterAiTimeoutMs
  });

  return (messageText: string) => classifyIntent({ messageText, descriptors: defaultIntentDescriptors, provider });
}

function createRuntimeForwardedEmailCapture(config: BotConfig): CaptureForwardedEmail {
  let captureForwardedEmail: CaptureForwardedEmail | undefined;

  return (email) => {
    captureForwardedEmail ??= createConvexForwardedEmailCapture(config);
    return captureForwardedEmail(email);
  };
}

export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? getConfig();
  const storage = options.storage ?? createRuntimeStorage(config);
  const capabilities = options.capabilities ?? createRuntimeCapabilities(config);
  const classify = options.classify ?? createRuntimeClassifier(config);
  const captureForwardedEmail = options.captureForwardedEmail ?? createRuntimeForwardedEmailCapture(config);
  const sendTelegram =
    options.sendTelegramMessage ??
    (({ chatId, text }: { chatId: string; text: string }) =>
      sendTelegramMessage({
        botToken: config.telegramBotToken,
        chatId,
        text
      }));
  const app = new Hono();

  app.get('/health', (c) => jsonOk(c, { ok: true }));
  app.route('/linking', createLinkingRoutes({ config, storage }));
  app.route(
    '/inbound-email',
    createInboundEmailRoutes({
      resendWebhookSecret: config.resendWebhookSecret,
      resendApiKey: config.resendApiKey,
      allowedForwardingSenders: config.forwardedEmailAllowedSenders,
      captureForwardedEmail
    })
  );
  app.route(
    '/notifications',
    createNotificationRoutes({
      serviceToken: config.botServiceToken,
      storage,
      sendTelegramMessage: sendTelegram
    })
  );
  app.route(
    '/telegram',
    createTelegramWebhookRoutes({
      config,
      storage,
      capabilities,
      classify,
      sendTelegramMessage: sendTelegram
    })
  );

  return app;
}

export type BotApp = ReturnType<typeof createApp>;

function getRuntimeApp() {
  runtimeApp ??= createApp();
  return runtimeApp;
}

function headersFromIncomingMessage(req: IncomingMessage) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
}

function requestFromIncomingMessage(req: IncomingMessage) {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `https://${host}`);
  const method = req.method ?? 'GET';
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers: headersFromIncomingMessage(req)
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = req as unknown as BodyInit;
    init.duplex = 'half';
  }

  return new Request(url, init);
}

async function writeFetchResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;

  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  const body = await response.arrayBuffer();
  res.end(Buffer.from(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const response = await getRuntimeApp().fetch(requestFromIncomingMessage(req));
    await writeFetchResponse(res, response);
  } catch {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'internal_server_error' }));
  }
}
