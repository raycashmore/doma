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
    expect(fetch).toHaveBeenCalledWith('https://api.telegram.org/bottelegram-bot-token/sendMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: '-100123',
        text: 'Linked.'
      })
    });
  });

  it('adds Telegram bold entities for configured briefing keywords without markup', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await expect(
      sendTelegramMessage({
        botToken: 'telegram-bot-token',
        chatId: '-100123',
        text: 'Library & <homework> dancing.'
      })
    ).resolves.toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledWith('https://api.telegram.org/bottelegram-bot-token/sendMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: '-100123',
        text: 'Library & <homework> dancing.',
        entities: [
          { type: 'bold', offset: 0, length: 7 },
          { type: 'bold', offset: 11, length: 8 },
          { type: 'bold', offset: 21, length: 7 }
        ]
      })
    });
  });

  it('adds Telegram bold entities for every configured keyword', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await expect(
      sendTelegramMessage({
        botToken: 'telegram-bot-token',
        chatId: '-100123',
        text: 'Swimming dancing library homework sport.'
      })
    ).resolves.toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledWith('https://api.telegram.org/bottelegram-bot-token/sendMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: '-100123',
        text: 'Swimming dancing library homework sport.',
        entities: [
          { type: 'bold', offset: 0, length: 8 },
          { type: 'bold', offset: 9, length: 7 },
          { type: 'bold', offset: 17, length: 7 },
          { type: 'bold', offset: 25, length: 8 },
          { type: 'bold', offset: 34, length: 5 }
        ]
      })
    });
  });

  it('returns the response status as the error code when Telegram rejects it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 429 }))
    );

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
