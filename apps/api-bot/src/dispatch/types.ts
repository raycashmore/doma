export interface CapabilityRequest {
  userId: string;
  command?: string;
  messageText: string;
  receivedAt: number;
  providerContext: {
    provider: string;
    providerUserId: string;
    providerChatId: string;
  };
}

export type CapabilityResponse =
  | { kind: 'reply'; text: string }
  | { kind: 'no_response' };

export type CapabilityHandler = (
  request: CapabilityRequest
) => Promise<CapabilityResponse>;
