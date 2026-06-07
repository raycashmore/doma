import { api } from '@repo/convex';
import { ConvexHttpClient } from 'convex/browser';

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
    loadCurrentWeek: () => client.query(api.schedule.queries.currentWeekForBot, { serviceToken })
  });

  return json(result);
}
