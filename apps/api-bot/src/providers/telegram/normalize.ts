import type { NormalizedInboundMessage } from '../types.js';
import type { TelegramUpdate } from './types.js';

const telegramCommandPattern = /^\/([A-Za-z0-9_]+)(?:@[A-Za-z0-9_]+)?(?:\s|$)/;

export function normalizeTelegramUpdate(
  update: TelegramUpdate
): NormalizedInboundMessage | null {
  const message = update.message;

  if (
    !message ||
    typeof message.text !== 'string' ||
    message.text.length === 0 ||
    !message.from ||
    message.from.is_bot
  ) {
    return null;
  }

  const commandMatch = telegramCommandPattern.exec(message.text);
  const displayLabel = message.from.username ?? message.from.first_name;

  return {
    provider: 'telegram',
    providerUserId: String(message.from.id),
    providerChatId: String(message.chat.id),
    text: message.text,
    command: commandMatch?.[1]?.toLowerCase(),
    receivedAt: message.date * 1_000,
    displayLabel,
    rawUpdateId: String(update.update_id)
  };
}
