import { afterEach, describe, expect, it, vi } from 'vitest';

import { classifyIntent } from './classifier.js';
import { createOpenAiIntentClassifierProvider } from './openAiClassifier.js';
import { defaultIntentDescriptors, NO_CAPABILITY } from './registry.js';

const descriptors = defaultIntentDescriptors;

describe('createOpenAiIntentClassifierProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests a strict structured classification and parses the JSON response', async () => {
    const requests: { url: string; body: unknown }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ capability: 'lists', confidence: 0.9 }) } }]
        }),
        { status: 200 }
      );
    };

    const provider = createOpenAiIntentClassifierProvider({
      apiKey: 'test-key',
      model: 'test-model',
      descriptors,
      fetchImpl
    });

    await expect(provider({ messageText: 'add milk', prompt: 'PROMPT' })).resolves.toEqual({
      capability: 'lists',
      confidence: 0.9
    });

    expect(requests[0]?.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(requests[0]?.body).toMatchObject({
      model: 'test-model',
      messages: [
        { role: 'system', content: 'PROMPT' },
        { role: 'user', content: 'add milk' }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'intent_router',
          strict: true,
          schema: { properties: { capability: { enum: ['lists', 'schedule', 'insights', 'briefing', NO_CAPABILITY] } } }
        }
      }
    });
  });

  it('throws when the API responds with a non-2xx status', async () => {
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 500 });
    const provider = createOpenAiIntentClassifierProvider({
      apiKey: 'test-key',
      model: 'test-model',
      descriptors,
      fetchImpl
    });

    await expect(provider({ messageText: 'add milk', prompt: 'PROMPT' })).rejects.toThrow();
  });

  it('throws when the response has no JSON content', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 });
    const provider = createOpenAiIntentClassifierProvider({
      apiKey: 'test-key',
      model: 'test-model',
      descriptors,
      fetchImpl
    });

    await expect(provider({ messageText: 'add milk', prompt: 'PROMPT' })).rejects.toThrow();
  });

  it('rejects when the request exceeds the configured timeout', async () => {
    vi.useFakeTimers();
    // A stalled provider: resolves only if its abort signal fires.
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });

    const provider = createOpenAiIntentClassifierProvider({
      apiKey: 'test-key',
      model: 'test-model',
      descriptors,
      fetchImpl,
      timeoutMs: 50
    });

    const pending = provider({ messageText: 'add milk', prompt: 'PROMPT' });
    const expectation = expect(pending).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(50);
    await expectation;
  });

  it('passes the abort signal through to fetch', async () => {
    let receivedSignal: AbortSignal | null | undefined;
    const fetchImpl: typeof fetch = async (_url, init) => {
      receivedSignal = init?.signal;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ capability: 'lists', confidence: 0.9 }) } }]
        }),
        { status: 200 }
      );
    };

    const provider = createOpenAiIntentClassifierProvider({
      apiKey: 'test-key',
      model: 'test-model',
      descriptors,
      fetchImpl
    });

    await provider({ messageText: 'add milk', prompt: 'PROMPT' });

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });

  it('classifyIntent falls back to none when the provider times out', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });

    const provider = createOpenAiIntentClassifierProvider({
      apiKey: 'test-key',
      model: 'test-model',
      descriptors,
      fetchImpl,
      timeoutMs: 50
    });

    const pending = classifyIntent({ messageText: 'add milk', descriptors, provider });

    await vi.advanceTimersByTimeAsync(50);

    await expect(pending).resolves.toEqual({ capability: NO_CAPABILITY });
    errorSpy.mockRestore();
  });
});
