import { describe, expect, it, vi } from 'vitest';

import { defaultIntentDescriptors, NO_CAPABILITY } from '../intent/registry.js';
import { buildCapabilitiesHint, createCommandDispatcher, DEFAULT_HELP } from './router.js';
import type { CapabilityRequest } from './types.js';

function request(overrides: Partial<CapabilityRequest> = {}): CapabilityRequest {
  return {
    userId: 'user_123',
    messageText: 'hello',
    receivedAt: 1_700_000_000,
    providerContext: {
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123'
    },
    ...overrides
  };
}

/** A classifier that always routes to one capability, recording its calls. */
function fixedClassifier(capability: string) {
  return vi.fn(async () => ({ capability }));
}

describe('createCommandDispatcher slash commands bypass the router', () => {
  it('routes /schedule directly to the schedule capability without classifying', async () => {
    const schedule = vi.fn(async () => ({ kind: 'reply' as const, text: 'Scheduling is warming up.' }));
    const classify = vi.fn();
    const dispatcher = createCommandDispatcher({ capabilities: { schedule }, classify });

    const result = await dispatcher.dispatch(request({ command: 'schedule', messageText: '/schedule tomorrow' }));

    expect(result).toEqual({ kind: 'reply', text: 'Scheduling is warming up.' });
    expect(classify).not.toHaveBeenCalled();
  });

  it('routes /briefing directly without an LLM call', async () => {
    const briefing = vi.fn(async () => ({ kind: 'reply' as const, text: 'Morning briefing' }));
    const classify = vi.fn();
    const dispatcher = createCommandDispatcher({ capabilities: { briefing }, classify });

    await dispatcher.dispatch(request({ command: 'briefing', messageText: '/briefing' }));

    expect(briefing).toHaveBeenCalled();
    expect(classify).not.toHaveBeenCalled();
  });

  it('returns default help for unknown slash commands without classifying', async () => {
    const classify = vi.fn();
    const dispatcher = createCommandDispatcher({ capabilities: {}, classify });

    await expect(dispatcher.dispatch(request({ command: 'unknown', messageText: '/unknown' }))).resolves.toEqual({
      kind: 'reply',
      text: DEFAULT_HELP
    });
    expect(classify).not.toHaveBeenCalled();
  });

  it('passes through no_response capability results', async () => {
    const dispatcher = createCommandDispatcher({
      capabilities: { schedule: vi.fn(async () => ({ kind: 'no_response' as const })) },
      classify: vi.fn()
    });

    await expect(dispatcher.dispatch(request({ command: 'schedule', messageText: '/schedule' }))).resolves.toEqual({
      kind: 'no_response'
    });
  });

  it('returns fallback reply when a slash capability throws', async () => {
    const dispatcher = createCommandDispatcher({
      capabilities: {
        schedule: vi.fn(async () => {
          throw new Error('capability unavailable');
        })
      },
      classify: vi.fn()
    });

    await expect(dispatcher.dispatch(request({ command: 'schedule', messageText: '/schedule' }))).resolves.toEqual({
      kind: 'reply',
      text: 'I could not handle that just now.'
    });
  });
});

describe('createCommandDispatcher free-text routing through the intent router', () => {
  it('routes an "add items" message to the lists capability', async () => {
    const lists = vi.fn(async () => ({ kind: 'reply' as const, text: 'Added 1 item to Shopping:\n• milk' }));
    const classify = fixedClassifier('lists');
    const dispatcher = createCommandDispatcher({ capabilities: { lists, schedule: vi.fn() }, classify });

    const freeText = request({ messageText: 'add milk' });
    const result = await dispatcher.dispatch(freeText);

    expect(result).toEqual({ kind: 'reply', text: 'Added 1 item to Shopping:\n• milk' });
    expect(classify).toHaveBeenCalledWith('add milk');
    expect(lists).toHaveBeenCalledWith(freeText);
  });

  it('routes a spending insights question to the insights capability', async () => {
    const insights = vi.fn(async () => ({ kind: 'reply' as const, text: 'Groceries crept up over winter.' }));
    const classify = fixedClassifier('insights');
    const dispatcher = createCommandDispatcher({ capabilities: { insights, lists: vi.fn() }, classify });

    const freeText = request({ messageText: 'what did the insights say about groceries?' });
    const result = await dispatcher.dispatch(freeText);

    expect(result).toEqual({ kind: 'reply', text: 'Groceries crept up over winter.' });
    expect(insights).toHaveBeenCalledWith(freeText);
  });

  it('routes a schedule-style ask to the schedule capability', async () => {
    const schedule = vi.fn(async () => ({ kind: 'reply' as const, text: "Here's today." }));
    const classify = fixedClassifier('schedule');
    const dispatcher = createCommandDispatcher({ capabilities: { schedule, lists: vi.fn() }, classify });

    const result = await dispatcher.dispatch(request({ messageText: "what's on today" }));

    expect(result).toEqual({ kind: 'reply', text: "Here's today." });
    expect(schedule).toHaveBeenCalled();
  });

  it('replies with a capabilities hint and creates nothing on none', async () => {
    const lists = vi.fn();
    const schedule = vi.fn();
    const classify = fixedClassifier(NO_CAPABILITY);
    const dispatcher = createCommandDispatcher({ capabilities: { lists, schedule }, classify });

    const result = await dispatcher.dispatch(request({ messageText: 'what is the meaning of life' }));

    expect(result).toEqual({ kind: 'reply', text: buildCapabilitiesHint() });
    expect(lists).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
  });

  it('replies with the capabilities hint when the chosen capability is not registered', async () => {
    const classify = fixedClassifier('lists');
    const dispatcher = createCommandDispatcher({ capabilities: { schedule: vi.fn() }, classify });

    const result = await dispatcher.dispatch(request({ messageText: 'add milk' }));

    expect(result).toEqual({ kind: 'reply', text: buildCapabilitiesHint() });
  });

  it('replies with the capabilities hint when no classifier is configured', async () => {
    const dispatcher = createCommandDispatcher({ capabilities: { lists: vi.fn() } });

    const result = await dispatcher.dispatch(request({ messageText: 'add milk' }));

    expect(result).toEqual({ kind: 'reply', text: buildCapabilitiesHint() });
  });

  it('returns the fallback reply when a routed capability throws', async () => {
    const lists = vi.fn(async () => {
      throw new Error('capability unavailable');
    });
    const classify = fixedClassifier('lists');
    const dispatcher = createCommandDispatcher({ capabilities: { lists }, classify });

    await expect(dispatcher.dispatch(request({ messageText: 'add milk' }))).resolves.toEqual({
      kind: 'reply',
      text: 'I could not handle that just now.'
    });
  });
});

describe('buildCapabilitiesHint', () => {
  it('mentions each default capability so users learn what the bot can do', () => {
    const hint = buildCapabilitiesHint();

    for (const descriptor of defaultIntentDescriptors) {
      expect(hint.toLowerCase()).toContain(descriptor.name);
    }
  });

  it('teaches users they can ask about spending insights', () => {
    expect(buildCapabilitiesHint().toLowerCase()).toContain('insights');
  });
});
