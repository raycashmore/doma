import { describe, expect, it, vi } from 'vitest';

import { createBotGatewayNotificationSender, parsePositiveIntegerEnv, parseRecipientUserIds } from './reminders';

describe('parseRecipientUserIds', () => {
  it('parses comma-separated configured recipients and ignores blanks', () => {
    expect(parseRecipientUserIds(' user_123, ,user_456,')).toEqual(['user_123', 'user_456']);
  });
});

describe('parsePositiveIntegerEnv', () => {
  it('uses the fallback unless the value is a positive integer', () => {
    expect(parsePositiveIntegerEnv(undefined, 30)).toBe(30);
    expect(parsePositiveIntegerEnv('0', 30)).toBe(30);
    expect(parsePositiveIntegerEnv('1.5', 30)).toBe(30);
    expect(parsePositiveIntegerEnv('45', 30)).toBe(45);
  });
});

describe('createBotGatewayNotificationSender', () => {
  const notification = {
    recipientUserId: 'user_123',
    topic: 'briefing.morning' as const,
    message: 'Morning briefing text',
    metadata: { briefingKey: 'morning:2026-06-13', localDate: '2026-06-13' }
  };

  it('posts notifications to the api-bot delivery boundary with service auth', async () => {
    const fetch = vi.fn(async () => Response.json({ status: 'sent', provider: 'telegram' }));
    vi.stubGlobal('fetch', fetch);
    const sendNotification = createBotGatewayNotificationSender({
      botGatewayOrigin: 'https://bot.example.com',
      serviceToken: 'service-token'
    });

    await expect(sendNotification(notification)).resolves.toEqual({ status: 'sent' });

    expect(fetch).toHaveBeenCalledWith('https://bot.example.com/notifications/send', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify(notification)
    });
    vi.unstubAllGlobals();
  });

  it('maps non-2xx api-bot responses to failed delivery results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'unauthorized' }, { status: 401 }))
    );
    const sendNotification = createBotGatewayNotificationSender({
      botGatewayOrigin: 'https://bot.example.com',
      serviceToken: 'service-token'
    });

    await expect(sendNotification(notification)).resolves.toEqual({
      status: 'failed',
      errorCode: 'bot_gateway_http_401'
    });
    vi.unstubAllGlobals();
  });

  it('maps malformed api-bot responses to failed delivery results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not json', { status: 200 }))
    );
    const sendNotification = createBotGatewayNotificationSender({
      botGatewayOrigin: 'https://bot.example.com',
      serviceToken: 'service-token'
    });

    await expect(sendNotification(notification)).resolves.toEqual({
      status: 'failed',
      errorCode: 'bot_gateway_invalid_response'
    });
    vi.unstubAllGlobals();
  });

  it('maps network errors to failed delivery results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );
    const sendNotification = createBotGatewayNotificationSender({
      botGatewayOrigin: 'https://bot.example.com',
      serviceToken: 'service-token'
    });

    await expect(sendNotification(notification)).resolves.toEqual({
      status: 'failed',
      errorCode: 'bot_gateway_network_error'
    });
    vi.unstubAllGlobals();
  });
});
