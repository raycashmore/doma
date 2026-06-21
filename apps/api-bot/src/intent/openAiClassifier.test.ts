import { describe, expect, it } from 'vitest';

import { createOpenAiIntentClassifierProvider } from './openAiClassifier.js';
import { defaultIntentDescriptors, NO_CAPABILITY } from './registry.js';

const descriptors = defaultIntentDescriptors;

describe('createOpenAiIntentClassifierProvider', () => {
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
          schema: { properties: { capability: { enum: ['lists', 'schedule', 'briefing', NO_CAPABILITY] } } }
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
});
