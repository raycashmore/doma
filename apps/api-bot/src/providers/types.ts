import type { ProviderName } from '../storage/types.js';

export type NormalizedInboundMessage = {
  provider: ProviderName;
  providerUserId: string;
  providerChatId: string;
  text: string;
  command?: string;
  commandBotUsername?: string;
  receivedAt: number;
  displayLabel?: string;
  rawUpdateId: string;
};
