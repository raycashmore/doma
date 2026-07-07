import { describe, expect, it, vi } from 'vitest';

import type { CapabilityRequest } from '../dispatch/types.js';
import { createInsightsCapability, NO_INSIGHT_REPLY } from './insightsCapability.js';

function request(messageText: string): CapabilityRequest {
  return {
    userId: 'user_123',
    messageText,
    receivedAt: 1_700_000_000,
    providerContext: {
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '456'
    }
  };
}

describe('createInsightsCapability', () => {
  it('replies with the freshly generated answer for the asked question', async () => {
    const answerQuestion = vi.fn(async () => ({
      status: 'answered' as const,
      answer: 'Groceries rose four months running, per the June insight.'
    }));
    const capability = createInsightsCapability({ answerQuestion });

    const result = await capability(request('what did the insights say about groceries?'));

    expect(result).toEqual({ kind: 'reply', text: 'Groceries rose four months running, per the June insight.' });
    expect(answerQuestion).toHaveBeenCalledWith('what did the insights say about groceries?');
  });

  it('says insights are not available yet when none is stored', async () => {
    const capability = createInsightsCapability({
      answerQuestion: vi.fn(async () => ({ status: 'no_insight' as const }))
    });

    await expect(capability(request('any insights this month?'))).resolves.toEqual({
      kind: 'reply',
      text: NO_INSIGHT_REPLY
    });
  });

  it('replies with the capability fallback when answering fails', async () => {
    const capability = createInsightsCapability({
      answerQuestion: vi.fn(async () => ({ status: 'failed' as const, reason: 'provider_failure' as const }))
    });

    await expect(capability(request('how is spending?'))).resolves.toEqual({
      kind: 'reply',
      text: 'I could not handle that just now.'
    });
  });

  it('replies with the capability fallback on an unrecognised result shape', async () => {
    const capability = createInsightsCapability({
      answerQuestion: vi.fn(async () => ({ status: '???' }) as never)
    });

    await expect(capability(request('how is spending?'))).resolves.toEqual({
      kind: 'reply',
      text: 'I could not handle that just now.'
    });
  });
});
