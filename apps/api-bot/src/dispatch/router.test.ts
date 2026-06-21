import { describe, expect, it, vi } from 'vitest';

import { createCommandDispatcher, DEFAULT_HELP } from './router.js';
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

describe('createCommandDispatcher', () => {
  it('routes schedule commands to the schedule capability', async () => {
    const schedule = vi.fn(async () => ({
      kind: 'reply' as const,
      text: 'Scheduling is warming up.'
    }));
    const dispatcher = createCommandDispatcher({
      capabilities: { schedule }
    });

    const result = await dispatcher.dispatch(request({ command: 'schedule', messageText: '/schedule tomorrow' }));

    expect(result).toEqual({
      kind: 'reply',
      text: 'Scheduling is warming up.'
    });
    expect(schedule).toHaveBeenCalledWith(request({ command: 'schedule', messageText: '/schedule tomorrow' }));
  });

  it('returns default help for unknown commands', async () => {
    const dispatcher = createCommandDispatcher({
      capabilities: {}
    });

    await expect(dispatcher.dispatch(request({ command: 'unknown', messageText: '/unknown' }))).resolves.toEqual({
      kind: 'reply',
      text: DEFAULT_HELP
    });
  });

  it('returns default help for plain text', async () => {
    const dispatcher = createCommandDispatcher({
      capabilities: {
        schedule: vi.fn()
      }
    });

    await expect(dispatcher.dispatch(request())).resolves.toEqual({
      kind: 'reply',
      text: DEFAULT_HELP
    });
  });

  it('routes free text to the lists capability when one is registered', async () => {
    const lists = vi.fn(async () => ({ kind: 'reply' as const, text: 'Added 1 item to Shopping:\n• milk' }));
    const dispatcher = createCommandDispatcher({ capabilities: { lists, schedule: vi.fn() } });

    const freeText = request({ messageText: 'milk' });
    const result = await dispatcher.dispatch(freeText);

    expect(result).toEqual({ kind: 'reply', text: 'Added 1 item to Shopping:\n• milk' });
    expect(lists).toHaveBeenCalledWith(freeText);
  });

  it('does not send slash commands to the lists capability', async () => {
    const lists = vi.fn(async () => ({ kind: 'reply' as const, text: 'should not be called' }));
    const dispatcher = createCommandDispatcher({ capabilities: { lists } });

    await expect(dispatcher.dispatch(request({ command: 'schedule', messageText: '/schedule' }))).resolves.toEqual({
      kind: 'reply',
      text: DEFAULT_HELP
    });
    expect(lists).not.toHaveBeenCalled();
  });

  it('passes through no_response capability results', async () => {
    const dispatcher = createCommandDispatcher({
      capabilities: {
        schedule: vi.fn(async () => ({ kind: 'no_response' as const }))
      }
    });

    await expect(dispatcher.dispatch(request({ command: 'schedule', messageText: '/schedule' }))).resolves.toEqual({
      kind: 'no_response'
    });
  });

  it('returns fallback reply when a capability throws', async () => {
    const dispatcher = createCommandDispatcher({
      capabilities: {
        schedule: vi.fn(async () => {
          throw new Error('capability unavailable');
        })
      }
    });

    await expect(dispatcher.dispatch(request({ command: 'schedule', messageText: '/schedule' }))).resolves.toEqual({
      kind: 'reply',
      text: 'I could not handle that just now.'
    });
  });
});
