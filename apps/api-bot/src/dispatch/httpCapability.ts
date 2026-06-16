import type { CapabilityHandler, CapabilityRequest, CapabilityResponse } from './types.js';
import { CAPABILITY_FALLBACK_RESPONSE, parseCapabilityResponse } from './types.js';

const DEFAULT_TIMEOUT_MS = 5_000;

function endpointDetails(endpointUrl: string) {
  const url = new URL(endpointUrl);
  return {
    endpointOrigin: url.origin,
    endpointPath: url.pathname,
    endpointHost: url.host
  };
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    message: String(error)
  };
}

export type CreateHttpCapabilityOptions = {
  endpointUrl: string;
  serviceToken: string;
  timeoutMs?: number;
};

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
        console.warn('[api-bot.capability] Capability request returned non-2xx response', {
          ...endpointDetails(endpointUrl),
          timeoutMs,
          status: response.status
        });
        return CAPABILITY_FALLBACK_RESPONSE;
      }

      const result = parseCapabilityResponse(await response.json());
      if (!result) {
        console.warn('[api-bot.capability] Capability request returned invalid response shape', {
          ...endpointDetails(endpointUrl),
          timeoutMs
        });
        return CAPABILITY_FALLBACK_RESPONSE;
      }

      return result;
    } catch (error) {
      console.warn('[api-bot.capability] Capability request failed', {
        ...endpointDetails(endpointUrl),
        timeoutMs,
        error: errorDetails(error)
      });
      return CAPABILITY_FALLBACK_RESPONSE;
    } finally {
      clearTimeout(timeout);
    }
  };
}
