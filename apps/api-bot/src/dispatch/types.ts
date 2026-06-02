import type { ProviderName } from '../storage/types.js';

export type CapabilityRequest = {
  userId: string;
  command?: string;
  messageText: string;
  receivedAt: number;
  providerContext: {
    provider: ProviderName;
    providerUserId: string;
    providerChatId: string;
  };
};

export type CapabilityResponse = { kind: 'reply'; text: string } | { kind: 'no_response' };

export type CapabilityHandler = (request: CapabilityRequest) => Promise<CapabilityResponse>;

export const CAPABILITY_FALLBACK_RESPONSE: CapabilityResponse = {
  kind: 'reply',
  text: 'I could not handle that just now.'
};

export function parseCapabilityResponse(value: unknown): CapabilityResponse | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const response = value as Record<string, unknown>;

  if (response.kind === 'reply' && typeof response.text === 'string') {
    return { kind: 'reply', text: response.text };
  }

  if (response.kind === 'no_response') {
    return { kind: 'no_response' };
  }

  return null;
}
