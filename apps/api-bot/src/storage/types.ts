export type ProviderName = 'telegram';

export type PairingTokenRecord = {
  tokenHash: string;
  clerkUserId: string;
  expiresAt: number;
  createdAt: number;
};

export type ChannelLinkRecord = {
  clerkUserId: string;
  provider: ProviderName;
  providerUserId: string;
  providerChatId: string;
  status: 'active' | 'revoked';
  createdAt: number;
  updatedAt: number;
  displayLabel?: string;
};

export type NotificationAttemptRecord = {
  id: string;
  recipientUserId: string;
  provider: ProviderName;
  topic: string;
  status: 'sent' | 'failed' | 'skipped';
  providerErrorCode?: string;
  createdAt: number;
};

export type BotStorage = {
  savePairingToken(record: PairingTokenRecord): Promise<void>;
  consumePairingToken(tokenHash: string, now?: number): Promise<PairingTokenRecord | null>;
  upsertChannelLink(record: ChannelLinkRecord): Promise<void>;
  revokeChannelLink(clerkUserId: string, provider: ProviderName, now?: number): Promise<void>;
  getActiveChannelLinkForUser(clerkUserId: string, provider: ProviderName): Promise<ChannelLinkRecord | null>;
  getActiveChannelLinkByProviderUser(provider: ProviderName, providerUserId: string): Promise<ChannelLinkRecord | null>;
  saveNotificationAttempt(record: NotificationAttemptRecord): Promise<void>;
};
