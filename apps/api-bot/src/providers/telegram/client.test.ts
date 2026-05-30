import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendTelegramMessage } from './client.js';

describe('sendTelegramMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a JSON sendMessage request to Telegram', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    const result = await sendTelegramMessage({
      botToken: 'telegram-bot-token',
      chatId: '-100123',
      text: 'Linked.'
    });

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottelegram-bot-token/sendMessage',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: '-100123',
          text: 'Linked.'
        })
      }
    );
  });

  it('returns the response status as the error code when Telegram rejects it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));

    await expect(
      sendTelegramMessage({
        botToken: 'telegram-bot-token',
        chatId: '-100123',
        text: 'Try again later.'
      })
    ).resolves.toEqual({ ok: false, errorCode: '429' });
  });

  it('returns network_error when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('socket closed');
      })
    );

    await expect(
      sendTelegramMessage({
        botToken: 'telegram-bot-token',
        chatId: '-100123',
        text: 'Try again later.'
      })
    ).resolves.toEqual({ ok: false, errorCode: 'network_error' });
  });

  it('returns the Telegram error code when a 2xx response body is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false, error_code: 400 }), {
            status: 200
          })
      )
    );

    await expect(
      sendTelegramMessage({
        botToken: 'telegram-bot-token',
        chatId: '-100123',
        text: 'Try again later.'
      })
    ).resolves.toEqual({ ok: false, errorCode: '400' });
  });
});
