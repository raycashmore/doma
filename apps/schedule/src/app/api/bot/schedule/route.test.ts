import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const convex = vi.hoisted(() => {
  const query = vi.fn();
  const client = vi.fn(function ConvexHttpClient() {
    return { query };
  });

  return { client, query };
});

vi.mock('@repo/convex', () => ({
  api: {
    schedule: {
      queries: {
        currentWeekForBot: 'schedule.queries.currentWeekForBot'
      }
    }
  }
}));

vi.mock('convex/browser', () => ({
  ConvexHttpClient: convex.client
}));

function capabilityRequest(body: unknown, token = 'service-token') {
  return new Request('https://schedule.example.com/schedule/api/bot/schedule', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

async function post(request: Request) {
  const route = await import('./route');
  return route.POST(request);
}

describe('schedule bot route', () => {
  beforeEach(() => {
    vi.resetModules();
    convex.client.mockClear();
    convex.query.mockReset();
    process.env.BOT_SERVICE_TOKEN = 'service-token';
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://convex.example.com';
    delete process.env.SCHEDULE_TZ;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.BOT_SERVICE_TOKEN;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.SCHEDULE_TZ;
  });

  it('rejects missing or invalid bearer tokens', async () => {
    const response = await post(
      capabilityRequest({ messageText: '/schedule', receivedAt: 1, userId: 'user_123' }, 'bad')
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(convex.client).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const response = await post(
      new Request('https://schedule.example.com/schedule/api/bot/schedule', {
        method: 'POST',
        headers: {
          authorization: 'Bearer service-token',
          'content-type': 'application/json'
        },
        body: '{'
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'bad_request' });
  });

  it('rejects invalid capability request bodies', async () => {
    const response = await post(capabilityRequest({ messageText: '/schedule' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_capability_request' });
  });

  it('returns a configuration error when Convex URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    const response = await post(capabilityRequest({ messageText: '/schedule', receivedAt: 1, userId: 'user_123' }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'missing_convex_url' });
    expect(convex.client).not.toHaveBeenCalled();
  });

  it('queries Convex and returns the schedule capability response', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T00:00:00.000Z'));
    convex.query.mockResolvedValue({
      events: [
        {
          googleEventId: 'event-1',
          start: Date.parse('2026-06-06T01:30:00.000Z'),
          end: Date.parse('2026-06-06T02:30:00.000Z'),
          allDay: false,
          title: 'School pickup',
          location: 'Main gate'
        }
      ]
    });

    const response = await post(
      capabilityRequest({
        messageText: '/schedule upcoming',
        receivedAt: Date.parse('2026-06-06T00:00:00.000Z'),
        userId: 'user_123'
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: 'reply',
      text: 'Upcoming events:\n- Sat, 6 June, 11:30 am: School pickup (Main gate)'
    });
    expect(convex.client).toHaveBeenCalledWith('https://convex.example.com');
    expect(convex.query).toHaveBeenCalledWith('schedule.queries.currentWeekForBot', { serviceToken: 'service-token' });
  });
});
