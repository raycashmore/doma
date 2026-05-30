import type { NormalizedInboundMessage } from '../types.js';
import type { TelegramUpdate } from './types.js';

const telegramCommandPattern = /^\/([A-Za-z0-9_]+)(?:@([A-Za-z0-9_]+))?(?:\s|$)/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeTelegramUpdate(
  update: TelegramUpdate
): NormalizedInboundMessage | null {
  if (!isRecord(update) || !isFiniteNumber(update.update_id)) {
    return null;
  }

  const message = update.message;

  if (
    !isRecord(message) ||
    typeof message.text !== 'string' ||
    message.text.length === 0 ||
    !isFiniteNumber(message.date) ||
    !isRecord(message.from) ||
    message.from.is_bot === true ||
    !isFiniteNumber(message.from.id) ||
    !isRecord(message.chat) ||
    !isFiniteNumber(message.chat.id) ||
    message.chat.type !== 'private'
  ) {
    return null;
  }

  const commandMatch = telegramCommandPattern.exec(message.text);
  const displayLabel =
    typeof message.from.username === 'string'
      ? message.from.username
      : typeof message.from.first_name === 'string'
        ? message.from.first_name
        : undefined;

  return {
    provider: 'telegram',
    providerUserId: String(message.from.id),
    providerChatId: String(message.chat.id),
    text: message.text,
    command: commandMatch?.[1]?.toLowerCase(),
    commandBotUsername: commandMatch?.[2],
    receivedAt: message.date * 1_000,
    displayLabel,
    rawUpdateId: String(update.update_id)
  };
}
