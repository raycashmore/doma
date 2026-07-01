import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHttpCapability } from './httpCapability.js';
import type { CapabilityRequest } from './types.js';

const fallback = {
  kind: 'reply',
  text: 'I could not handle that just now.'
};

function request(): CapabilityRequest {
  return {
    userId: 'user_123',
    command: 'schedule',
    messageText: '/schedule tomorrow',
    receivedAt: 1_700_000_000_000,
    providerContext: {
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123'
    }
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init
  });
}

describe('createHttpCapability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('posts the capability request with bearer auth and JSON content', async () => {
    const fetch = vi.fn(async () => jsonResponse({ kind: 'reply', text: 'Scheduled.' }));
    vi.stubGlobal('fetch', fetch);
    const handler = createHttpCapability({
      endpointUrl: 'https://capability.example.com/schedule',
      serviceToken: 'service-token'
    });
    const capabilityRequest = request();

    await handler(capabilityRequest);

    expect(fetch).toHaveBeenCalledWith(
      'https://capability.example.com/schedule',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer service-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(capabilityRequest),
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('returns a sanitized reply response from an ok upstream response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ kind: 'reply', text: 'Scheduled.', internalToken: 'secret' }))
    );
    const handler = createHttpCapability({
      endpointUrl: 'https://capability.example.com/schedule',
      serviceToken: 'service-token'
    });

    await expect(handler(request())).resolves.toEqual({
      kind: 'reply',
      text: 'Scheduled.'
    });
  });

  it('strips provider formatting fields from an ok upstream response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ kind: 'reply', text: 'Library bag.', parseMode: 'HTML', internalToken: 'secret' })
      )
    );
    const handler = createHttpCapability({
      endpointUrl: 'https://capability.example.com/schedule',
      serviceToken: 'service-token'
    });

    await expect(handler(request())).resolves.toEqual({
      kind: 'reply',
      text: 'Library bag.'
    });
  });

  it('returns a sanitized no_response response from an ok upstream response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ kind: 'no_response', internalToken: 'secret' }))
    );
    const handler = createHttpCapability({
      endpointUrl: 'https://capability.example.com/schedule',
      serviceToken: 'service-token'
    });

    await expect(handler(request())).resolves.toEqual({ kind: 'no_response' });
  });

  it('returns fallback reply for non-2xx responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ kind: 'reply', text: 'Nope.' }, { status: 503 }))
    );
    const handler = createHttpCapability({
      endpointUrl: 'https://capability.example.com/schedule',
      serviceToken: 'service-token'
    });

    await expect(handler(request())).resolves.toEqual(fallback);
  });

  it('returns fallback reply for malformed JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{"kind":', {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
      )
    );
    const handler = createHttpCapability({
      endpointUrl: 'https://capability.example.com/schedule',
      serviceToken: 'service-token'
    });

    await expect(handler(request())).resolves.toEqual(fallback);
  });

  it('returns fallback reply for invalid response shapes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          kind: 'debug_dump',
          text: 'leak me',
          serviceToken: 'secret'
        })
      )
    );
    const handler = createHttpCapability({
      endpointUrl: 'https://capability.example.com/schedule',
      serviceToken: 'service-token'
    });

    await expect(handler(request())).resolves.toEqual(fallback);
  });

  it('returns fallback reply for reply responses missing text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ kind: 'reply' }))
    );
    const handler = createHttpCapability({
      endpointUrl: 'https://capability.example.com/schedule',
      serviceToken: 'service-token'
    });

    await expect(handler(request())).resolves.toEqual(fallback);
  });

  it('returns fallback reply when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );
    const handler = createHttpCapability({
      endpointUrl: 'https://capability.example.com/schedule',
      serviceToken: 'service-token'
    });

    await expect(handler(request())).resolves.toEqual(fallback);
  });

  it('logs a sanitized warning when the upstream capability fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted.', 'AbortError');
      })
    );
    const handler = createHttpCapability({
      endpointUrl: 'https://capability.example.com/schedule',
      serviceToken: 'service-token',
      timeoutMs: 25
    });

    await expect(handler(request())).resolves.toEqual(fallback);

    expect(warn).toHaveBeenCalledWith(
      '[api-bot.capability] Capability request failed',
      expect.objectContaining({
        endpointOrigin: 'https://capability.example.com',
        endpointPath: '/schedule',
        timeoutMs: 25,
        error: expect.objectContaining({
          name: 'AbortError',
          message: 'The operation was aborted.'
        })
      })
    );

    warn.mockRestore();
  });
});
