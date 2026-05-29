import type {
  CapabilityHandler,
  CapabilityRequest,
  CapabilityResponse
} from './types.js';

const DEFAULT_TIMEOUT_MS = 5_000;
const FALLBACK_RESPONSE: CapabilityResponse = {
  kind: 'reply',
  text: 'I could not handle that just now.'
};

export interface CreateHttpCapabilityOptions {
  endpointUrl: string;
  serviceToken: string;
  timeoutMs?: number;
}

export function createHttpCapability({
  endpointUrl,
  serviceToken,
  timeoutMs = DEFAULT_TIMEOUT_MS
}: CreateHttpCapabilityOptions): CapabilityHandler {
  return async (request: CapabilityRequest): Promise<CapabilityResponse> => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: abortController.signal
      });

      if (!response.ok) {
        return FALLBACK_RESPONSE;
      }

      return (await response.json()) as CapabilityResponse;
    } catch {
      return FALLBACK_RESPONSE;
    } finally {
      clearTimeout(timeout);
    }
  };
}
