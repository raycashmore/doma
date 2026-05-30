import { describe, expect, it, vi } from 'vitest';
import type { BotStorage, ChannelLinkRecord } from '../storage/index.js';
import { createNotificationRoutes } from './routes.js';

function createStorage(link: ChannelLinkRecord | null = null) {
  return {
    savePairingToken: vi.fn(),
    consumePairingToken: vi.fn(),
    upsertChannelLink: vi.fn(),
    revokeChannelLink: vi.fn(),
    getActiveChannelLinkForUser: vi.fn(async () => link),
    getActiveChannelLinkByProviderUser: vi.fn(),
    saveNotificationAttempt: vi.fn()
  } satisfies BotStorage;
}

function sendRequest(body: unknown, token = 'service-token') {
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };

  if (token.length > 0) {
    headers.authorization = `Bearer ${token}`;
  }

  return new Request('https://bot.example.com/send', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

const linkedTelegramChannel: ChannelLinkRecord = {
  clerkUserId: 'user_123',
  provider: 'telegram',
  providerUserId: '789',
  providerChatId: '-100123',
  status: 'active',
  createdAt: 1,
  updatedAt: 1,
  displayLabel: 'ray_cashmore'
};

describe('createNotificationRoutes', () => {
  it('rejects requests without service bearer auth', async () => {
    const storage = createStorage();
    const sendTelegramMessage = vi.fn();
    const routes = createNotificationRoutes({
      serviceToken: 'service-token',
      storage,
      sendTelegramMessage
    });

    const response = await routes.request(sendRequest({}, ''));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(storage.saveNotificationAttempt).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('returns a stable JSON 400 for malformed JSON', async () => {
    const routes = createNotificationRoutes({
      serviceToken: 'service-token',
      storage: createStorage(),
      sendTelegramMessage: vi.fn()
    });

    const response = await routes.request(sendRequest('{"recipientUserId":'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'bad_request' });
  });

  it('returns invalid_notification for schema failures', async () => {
    const routes = createNotificationRoutes({
      serviceToken: 'service-token',
      storage: createStorage(),
      sendTelegramMessage: vi.fn()
    });

    const response = await routes.request(
      sendRequest({
        recipientUserId: '',
        topic: 'budget',
        message: 'Budget updated.'
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_notification'
    });
  });

  it('skips and records an attempt without storing the message when no channel is linked', async () => {
    const storage = createStorage();
    const sendTelegramMessage = vi.fn();
    const routes = createNotificationRoutes({
      serviceToken: 'service-token',
      storage,
      sendTelegramMessage
    });

    const response = await routes.request(
      sendRequest({
        recipientUserId: 'user_123',
        topic: 'budget',
        message: 'Budget updated.',
        metadata: { source: 'test' }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'skipped',
      reason: 'no_linked_channel'
    });
    expect(storage.getActiveChannelLinkForUser).toHaveBeenCalledWith(
      'user_123',
      'telegram'
    );
    expect(sendTelegramMessage).not.toHaveBeenCalled();
    expect(storage.saveNotificationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user_123',
        provider: 'telegram',
        topic: 'budget',
        status: 'skipped',
        providerErrorCode: 'no_linked_channel'
      })
    );
    expect(storage.saveNotificationAttempt).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Budget updated.' })
    );
  });

  it('sends Telegram messages to a linked channel and records a sent attempt', async () => {
    const storage = createStorage(linkedTelegramChannel);
    const sendTelegramMessage = vi.fn(async () => ({ ok: true as const }));
    const routes = createNotificationRoutes({
      serviceToken: 'service-token',
      storage,
      sendTelegramMessage
    });

    const response = await routes.request(
      sendRequest({
        recipientUserId: 'user_123',
        topic: 'budget',
        message: 'Budget updated.'
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'sent',
      provider: 'telegram'
    });
    expect(sendTelegramMessage).toHaveBeenCalledWith({
      chatId: '-100123',
      text: 'Budget updated.'
    });
    expect(storage.saveNotificationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user_123',
        provider: 'telegram',
        topic: 'budget',
        status: 'sent'
      })
    );
    expect(storage.saveNotificationAttempt).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Budget updated.' })
    );
  });

  it('records failed Telegram sends with the provider error code', async () => {
    const storage = createStorage(linkedTelegramChannel);
    const sendTelegramMessage = vi.fn(async () => ({
      ok: false as const,
      errorCode: '429'
    }));
    const routes = createNotificationRoutes({
      serviceToken: 'service-token',
      storage,
      sendTelegramMessage
    });

    const response = await routes.request(
      sendRequest({
        recipientUserId: 'user_123',
        topic: 'budget',
        message: 'Budget updated.'
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'failed',
      provider: 'telegram',
      errorCode: '429'
    });
    expect(storage.saveNotificationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user_123',
        provider: 'telegram',
        topic: 'budget',
        status: 'failed',
        providerErrorCode: '429'
      })
    );
  });

  it('records failed attempts when the sender rejects', async () => {
    const storage = createStorage(linkedTelegramChannel);
    const sendTelegramMessage = vi.fn(async () => {
      throw new Error('network unavailable');
    });
    const routes = createNotificationRoutes({
      serviceToken: 'service-token',
      storage,
      sendTelegramMessage
    });

    const response = await routes.request(
      sendRequest({
        recipientUserId: 'user_123',
        topic: 'budget',
        message: 'Budget updated.'
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'failed',
      provider: 'telegram',
      errorCode: 'network_error'
    });
    expect(storage.saveNotificationAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user_123',
        provider: 'telegram',
        topic: 'budget',
        status: 'failed',
        providerErrorCode: 'network_error'
      })
    );
    expect(storage.saveNotificationAttempt).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Budget updated.' })
    );
  });
});
