import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const convex = vi.hoisted(() => {
  const query = vi.fn();
  const action = vi.fn();
  const mutation = vi.fn();
  const client = vi.fn(function ConvexHttpClient() {
    return { action, mutation, query };
  });
  return { action, client, mutation, query };
});

vi.mock('@repo/convex', () => ({
  api: {
    lists: {
      bot: {
        parseListItemsForBot: 'lists.bot.parseListItemsForBot',
        defaultListForBot: 'lists.bot.defaultListForBot',
        createListItemsForBot: 'lists.bot.createListItemsForBot'
      }
    }
  }
}));

vi.mock('convex/browser', () => ({ ConvexHttpClient: convex.client }));

function capabilityRequest(body: unknown, token = 'service-token') {
  const request = new Request('https://lists.example.com/api/bot/lists', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { request } as unknown as Parameters<Awaited<ReturnType<typeof loadRoute>>['POST']>[0];
}

async function loadRoute() {
  return import('./+server');
}

async function post(event: ReturnType<typeof capabilityRequest>) {
  const route = await loadRoute();
  return route.POST(event);
}

const freeText = { userId: 'user_b', messageText: 'milk, bread, eggs', receivedAt: 1 };

describe('lists bot route', () => {
  beforeEach(() => {
    vi.resetModules();
    convex.action.mockReset();
    convex.client.mockClear();
    convex.mutation.mockReset();
    convex.query.mockReset();
    process.env.BOT_SERVICE_TOKEN = 'service-token';
    process.env.CONVEX_URL = 'https://convex.example.com';
  });

  afterEach(() => {
    delete process.env.BOT_SERVICE_TOKEN;
    delete process.env.CONVEX_URL;
  });

  it('rejects missing or invalid bearer tokens', async () => {
    const response = await post(capabilityRequest(freeText, 'bad'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(convex.client).not.toHaveBeenCalled();
  });

  it('returns a configuration error when the Convex URL is missing', async () => {
    delete process.env.CONVEX_URL;
    delete process.env.VITE_CONVEX_URL;

    const response = await post(capabilityRequest(freeText));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'missing_convex_url' });
    expect(convex.client).not.toHaveBeenCalled();
  });

  it('parses, creates items in the default list, and returns a confirmation', async () => {
    convex.action.mockResolvedValue({ targetListId: null, items: ['milk', 'bread', 'eggs'] });
    convex.query.mockResolvedValue({ publicId: 'list_shared', name: 'Shopping' });
    convex.mutation.mockResolvedValue({
      list: { publicId: 'list_shared', name: 'Shopping' },
      items: [
        { id: 'i1', title: 'milk' },
        { id: 'i2', title: 'bread' },
        { id: 'i3', title: 'eggs' }
      ]
    });

    const response = await post(capabilityRequest(freeText));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: 'reply',
      text: 'Added 3 items to Shopping:\n• milk\n• bread\n• eggs'
    });
    expect(convex.client).toHaveBeenCalledWith('https://convex.example.com');
    expect(convex.action).toHaveBeenCalledWith('lists.bot.parseListItemsForBot', {
      serviceToken: 'service-token',
      messageText: 'milk, bread, eggs'
    });
    expect(convex.query).toHaveBeenCalledWith('lists.bot.defaultListForBot', {
      serviceToken: 'service-token',
      clerkUserId: 'user_b'
    });
    expect(convex.mutation).toHaveBeenCalledWith('lists.bot.createListItemsForBot', {
      serviceToken: 'service-token',
      clerkUserId: 'user_b',
      listPublicId: 'list_shared',
      titles: ['milk', 'bread', 'eggs']
    });
  });
});
