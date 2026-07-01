import { api } from '@repo/convex';
import { ConvexHttpClient } from 'convex/browser';

import type { BotMorningBriefing } from '@/bot/capability';
import { handleScheduleCapabilityRequest, parseBotCapabilityRequest } from '@/bot/capability';

export const runtime = 'nodejs';

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  const match = /^Bearer\s+(.+)$/i.exec(header ?? '');
  return match?.[1] ?? null;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function isBotMorningBriefing(value: unknown): value is BotMorningBriefing {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const briefing = value as Record<string, unknown>;
  return (
    typeof briefing.briefingKey === 'string' &&
    typeof briefing.localDate === 'string' &&
    typeof briefing.message === 'string' &&
    typeof briefing.shouldSend === 'boolean' &&
    (briefing.generationStatus === 'ai' ||
      briefing.generationStatus === 'deterministic' ||
      briefing.generationStatus === 'fallback' ||
      briefing.generationStatus === 'setupProblem')
  );
}

function generatedBriefingFromResult(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid generated briefing result');
  }

  const result = value as Record<string, unknown>;
  if (isBotMorningBriefing(result.briefing)) {
    return result.briefing;
  }

  throw new Error('Invalid generated briefing result');
}

export async function POST(request: Request) {
  const serviceToken = process.env.BOT_SERVICE_TOKEN;
  const token = bearerToken(request);

  if (!serviceToken || token !== serviceToken) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const capabilityRequest = parseBotCapabilityRequest(body);
  if (!capabilityRequest) {
    return json({ error: 'invalid_capability_request' }, 400);
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return json({ error: 'missing_convex_url' }, 500);
  }

  const client = new ConvexHttpClient(convexUrl);
  const result = await handleScheduleCapabilityRequest(capabilityRequest, {
    timeZone: process.env.SCHEDULE_TZ,
    loadCurrentWeek: () => client.query(api.schedule.queries.currentWeekForBot, { serviceToken }),
    loadMorningBriefing: async ({ localDate }) => {
      const briefing = await client.query(api.briefing.generation.briefingForBot, {
        serviceToken,
        briefingKind: 'morning',
        localDate
      });
      if (briefing === null) return null;
      if (isBotMorningBriefing(briefing)) return briefing;
      throw new Error('Invalid morning briefing result');
    },
    generateMorningBriefing: async ({ localDate, timeZone, generatedAt }) => {
      return generatedBriefingFromResult(
        await client.action(api.briefing.generation.generateAndStoreMorningBriefingForBot, {
          serviceToken,
          localDate,
          timeZone,
          generatedAt
        })
      );
    },
    loadMorningBriefingDeliveryPreview: async ({ localDate, timeZone, generatedAt, slot }) => {
      return generatedBriefingFromResult(
        await client.action(api.briefing.generation.renderMorningBriefingDeliveryPreviewForBot, {
          serviceToken,
          localDate,
          timeZone,
          generatedAt,
          slot
        })
      );
    },
    markMorningBriefingDelivered: ({ briefingKey, recipientUserId, attemptedAt }) =>
      client.mutation(api.briefing.generation.recordBriefingDeliveryForBot, {
        serviceToken,
        briefingKey,
        recipientUserId,
        attemptedAt,
        status: 'sent'
      })
  });

  return json(result);
}
