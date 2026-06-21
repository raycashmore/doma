import { describe, expect, it, vi } from 'vitest';

import {
  buildIntentRouterPrompt,
  classifyIntent,
  type IntentClassifierProvider,
  intentRouterOutputJsonSchema
} from './classifier.js';
import { defaultIntentDescriptors, NO_CAPABILITY } from './registry.js';

const descriptors = defaultIntentDescriptors;

describe('buildIntentRouterPrompt', () => {
  it('lists every registered capability name, description and examples', () => {
    const prompt = buildIntentRouterPrompt(descriptors);

    for (const descriptor of descriptors) {
      expect(prompt).toContain(descriptor.name);
      expect(prompt).toContain(descriptor.description);
      for (const example of descriptor.examples) {
        expect(prompt).toContain(example);
      }
    }
  });

  it('tells the model to pick exactly one capability or none and not to parse content', () => {
    const prompt = buildIntentRouterPrompt(descriptors);

    expect(prompt).toContain(NO_CAPABILITY);
    expect(prompt.toLowerCase()).toContain('exactly one');
    expect(prompt.toLowerCase()).toContain('do not');
  });
});

describe('intentRouterOutputJsonSchema', () => {
  it('constrains the capability to the registered names plus none', () => {
    const schema = intentRouterOutputJsonSchema(descriptors);

    expect(schema.properties.capability.enum).toEqual(['lists', 'schedule', 'briefing', NO_CAPABILITY]);
    expect(schema.required).toContain('capability');
  });
});

describe('classifyIntent', () => {
  it('routes a message to the capability the provider selects', async () => {
    const provider: IntentClassifierProvider = vi.fn(async () => ({ capability: 'lists', confidence: 0.9 }));

    await expect(
      classifyIntent({ messageText: 'add milk and eggs', descriptors, provider })
    ).resolves.toEqual({ capability: 'lists' });
  });

  it('routes a schedule-style ask to the schedule capability', async () => {
    const provider: IntentClassifierProvider = vi.fn(async () => ({ capability: 'schedule', confidence: 0.8 }));

    await expect(
      classifyIntent({ messageText: "what's on today", descriptors, provider })
    ).resolves.toEqual({ capability: 'schedule' });
  });

  it('returns none when the provider selects none', async () => {
    const provider: IntentClassifierProvider = vi.fn(async () => ({ capability: NO_CAPABILITY, confidence: 0.95 }));

    await expect(
      classifyIntent({ messageText: 'what is the meaning of life', descriptors, provider })
    ).resolves.toEqual({ capability: NO_CAPABILITY });
  });

  it('falls back to none on low confidence below the threshold', async () => {
    const provider: IntentClassifierProvider = vi.fn(async () => ({ capability: 'lists', confidence: 0.2 }));

    await expect(
      classifyIntent({ messageText: 'hmm', descriptors, provider, minConfidence: 0.5 })
    ).resolves.toEqual({ capability: NO_CAPABILITY });
  });

  it('falls back to none when the provider returns a capability that is not registered', async () => {
    const provider: IntentClassifierProvider = vi.fn(async () => ({ capability: 'weather', confidence: 0.99 }));

    await expect(classifyIntent({ messageText: 'sunny?', descriptors, provider })).resolves.toEqual({
      capability: NO_CAPABILITY
    });
  });

  it('falls back to none on a malformed provider response', async () => {
    const provider: IntentClassifierProvider = vi.fn(async () => ({ nonsense: true }) as unknown);

    await expect(classifyIntent({ messageText: 'add milk', descriptors, provider })).resolves.toEqual({
      capability: NO_CAPABILITY
    });
  });

  it('logs and falls back to none when the provider throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider: IntentClassifierProvider = vi.fn(async () => {
      throw new Error('provider unavailable');
    });

    await expect(classifyIntent({ messageText: 'add milk', descriptors, provider })).resolves.toEqual({
      capability: NO_CAPABILITY
    });

    expect(errorSpy).toHaveBeenCalledWith(
      '[api-bot.intent] Falling back to none after intent classifier failure',
      expect.objectContaining({ error: expect.objectContaining({ message: 'provider unavailable' }) })
    );

    errorSpy.mockRestore();
  });
});
