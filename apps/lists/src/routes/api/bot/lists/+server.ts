import { createHash, timingSafeEqual } from 'node:crypto';

import { api } from '@repo/convex';
import { ConvexHttpClient } from 'convex/browser';

import { handleListsCapabilityRequest, type ListsCapabilityRequest } from '$lib/bot/capability';

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  return match?.[1] ?? null;
}

// Hash to a fixed length before timingSafeEqual so the comparison time does not
// leak the token length. Mirrors the api-bot service-auth boundary.
function constantTimeEquals(value: string, expected: string): boolean {
  const valueDigest = createHash('sha256').update(value).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(valueDigest, expectedDigest);
}

function isAuthorized(request: Request, serviceToken: string): boolean {
  const token = bearerToken(request);
  return token !== null && constantTimeEquals(token, serviceToken);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function parseCapabilityRequest(value: unknown): ListsCapabilityRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const request = value as Record<string, unknown>;
  if (
    typeof request.userId !== 'string' ||
    typeof request.messageText !== 'string' ||
    typeof request.receivedAt !== 'number'
  ) {
    return null;
  }
  return { userId: request.userId, messageText: request.messageText, receivedAt: request.receivedAt };
}

export async function POST({ request }: { request: Request }) {
  const serviceToken = process.env.BOT_SERVICE_TOKEN;
  if (!serviceToken || !isAuthorized(request, serviceToken)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const capabilityRequest = parseCapabilityRequest(body);
  if (!capabilityRequest) {
    return json({ error: 'invalid_capability_request' }, 400);
  }

  const convexUrl = process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    return json({ error: 'missing_convex_url' }, 500);
  }

  const client = new ConvexHttpClient(convexUrl);
  const result = await handleListsCapabilityRequest(capabilityRequest, {
    parseItems: ({ messageText }) => client.action(api.lists.bot.parseListItemsForBot, { serviceToken, messageText }),
    loadDefaultList: ({ userId }) =>
      client.query(api.lists.bot.defaultListForBot, { serviceToken, clerkUserId: userId }),
    createItems: ({ userId, listPublicId, titles }) =>
      client.mutation(api.lists.bot.createListItemsForBot, {
        serviceToken,
        clerkUserId: userId,
        listPublicId,
        titles
      })
  });

  return json(result);
}
