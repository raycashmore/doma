import { describe, expect, it } from 'vitest';
import { normalizeTelegramUpdate } from './normalize.js';
import type { TelegramUpdate } from './types.js';

describe('normalizeTelegramUpdate', () => {
  it('extracts inbound message fields from text updates', () => {
    const update: TelegramUpdate = {
      update_id: 123,
      message: {
        message_id: 456,
        date: 1_700_000_000,
        text: '/Start@Doma_Bot abc123',
        from: {
          id: 789,
          is_bot: false,
          first_name: 'Ray',
          username: 'ray_cashmore'
        },
        chat: {
          id: -100123,
          type: 'private'
        }
      }
    };

    expect(normalizeTelegramUpdate(update)).toEqual({
      provider: 'telegram',
      providerUserId: '789',
      providerChatId: '-100123',
      text: '/Start@Doma_Bot abc123',
      command: 'start',
      receivedAt: 1_700_000_000_000,
      displayLabel: 'ray_cashmore',
      rawUpdateId: '123'
    });
  });

  it('uses first name when username is absent', () => {
    const update: TelegramUpdate = {
      update_id: 124,
      message: {
        message_id: 457,
        date: 1_700_000_001,
        text: 'hello',
        from: {
          id: 790,
          is_bot: false,
          first_name: 'Rae'
        },
        chat: {
          id: 790,
          type: 'private'
        }
      }
    };

    expect(normalizeTelegramUpdate(update)?.displayLabel).toBe('Rae');
  });

  it('normalizes slash commands without bot suffix', () => {
    const update: TelegramUpdate = {
      update_id: 125,
      message: {
        message_id: 458,
        date: 1_700_000_002,
        text: '/HELP',
        from: {
          id: 791,
          is_bot: false,
          first_name: 'Ray'
        },
        chat: {
          id: 791,
          type: 'private'
        }
      }
    };

    expect(normalizeTelegramUpdate(update)?.command).toBe('help');
  });

  it.each([
    ['non-message updates', { update_id: 126 }],
    [
      'messages without text',
      {
        update_id: 127,
        message: {
          message_id: 459,
          date: 1_700_000_003,
          from: { id: 792, is_bot: false, first_name: 'Ray' },
          chat: { id: 792, type: 'private' }
        }
      }
    ],
    [
      'messages without sender',
      {
        update_id: 128,
        message: {
          message_id: 460,
          date: 1_700_000_004,
          text: 'hello',
          chat: { id: 793, type: 'private' }
        }
      }
    ],
    [
      'bot senders',
      {
        update_id: 129,
        message: {
          message_id: 461,
          date: 1_700_000_005,
          text: 'hello',
          from: { id: 794, is_bot: true, first_name: 'Bot' },
          chat: { id: 794, type: 'private' }
        }
      }
    ]
  ] satisfies Array<[string, TelegramUpdate]>)('returns null for %s', (_, update) => {
    expect(normalizeTelegramUpdate(update)).toBeNull();
  });
});
