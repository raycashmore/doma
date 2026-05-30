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
      commandBotUsername: 'Doma_Bot',
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

  it('keeps non-command text commandless', () => {
    const update: TelegramUpdate = {
      update_id: 126,
      message: {
        message_id: 459,
        date: 1_700_000_003,
        text: 'hello',
        from: {
          id: 792,
          is_bot: false,
          first_name: 'Ray'
        },
        chat: {
          id: 792,
          type: 'private'
        }
      }
    };

    expect(normalizeTelegramUpdate(update)?.command).toBeUndefined();
  });

  it.each([
    ['non-message updates', { update_id: 127 }],
    [
      'edited message updates',
      {
        update_id: 128,
        edited_message: {
          message_id: 461,
          date: 1_700_000_005,
          text: 'edited',
          from: { id: 794, is_bot: false, first_name: 'Ray' },
          chat: { id: 794, type: 'private' }
        }
      }
    ],
    [
      'channel post updates',
      {
        update_id: 129,
        channel_post: {
          message_id: 462,
          date: 1_700_000_006,
          text: 'channel',
          chat: { id: -100123, type: 'channel' }
        }
      }
    ],
    [
      'updates without numeric update ids',
      {
        update_id: 'not-a-number',
        message: {
          message_id: 463,
          date: 1_700_000_007,
          text: 'hello',
          from: { id: 793, is_bot: false, first_name: 'Ray' },
          chat: { id: 793, type: 'private' }
        }
      }
    ],
    [
      'messages without text',
      {
        update_id: 130,
        message: {
          message_id: 464,
          date: 1_700_000_008,
          from: { id: 794, is_bot: false, first_name: 'Ray' },
          chat: { id: 794, type: 'private' }
        }
      }
    ],
    [
      'messages with non-string text',
      {
        update_id: 131,
        message: {
          message_id: 465,
          date: 1_700_000_009,
          text: 123,
          from: { id: 795, is_bot: false, first_name: 'Ray' },
          chat: { id: 795, type: 'private' }
        }
      }
    ],
    [
      'messages without numeric dates',
      {
        update_id: 132,
        message: {
          message_id: 466,
          date: 'not-a-number',
          text: 'hello',
          from: { id: 796, is_bot: false, first_name: 'Ray' },
          chat: { id: 796, type: 'private' }
        }
      }
    ],
    [
      'messages without sender',
      {
        update_id: 133,
        message: {
          message_id: 467,
          date: 1_700_000_010,
          text: 'hello',
          chat: { id: 797, type: 'private' }
        }
      }
    ],
    [
      'messages without numeric sender ids',
      {
        update_id: 134,
        message: {
          message_id: 468,
          date: 1_700_000_011,
          text: 'hello',
          from: { id: 'not-a-number', is_bot: false, first_name: 'Ray' },
          chat: { id: 798, type: 'private' }
        }
      }
    ],
    [
      'messages without chat',
      {
        update_id: 135,
        message: {
          message_id: 469,
          date: 1_700_000_012,
          text: 'hello',
          from: { id: 799, is_bot: false, first_name: 'Ray' }
        }
      }
    ],
    [
      'messages without numeric chat ids',
      {
        update_id: 136,
        message: {
          message_id: 470,
          date: 1_700_000_013,
          text: 'hello',
          from: { id: 800, is_bot: false, first_name: 'Ray' },
          chat: { id: 'not-a-number', type: 'private' }
        }
      }
    ],
    [
      'bot senders',
      {
        update_id: 137,
        message: {
          message_id: 471,
          date: 1_700_000_014,
          text: 'hello',
          from: { id: 801, is_bot: true, first_name: 'Bot' },
          chat: { id: 801, type: 'private' }
        }
      }
    ]
  ] satisfies Array<[string, unknown]>)('returns null for %s', (_, update) => {
    expect(normalizeTelegramUpdate(update as TelegramUpdate)).toBeNull();
  });
});
