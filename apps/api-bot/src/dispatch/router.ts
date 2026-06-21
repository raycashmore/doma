import type { CapabilityHandler, CapabilityRequest, CapabilityResponse } from './types.js';
import { CAPABILITY_FALLBACK_RESPONSE } from './types.js';

export const DEFAULT_HELP = 'I can help with scheduling soon. Try /schedule.';

// Free-text (non-slash) messages are routed to this capability. This is the
// single-capability shortcut for the tracer slice; a multi-capability intent
// router replaces it in a later slice.
const FREE_TEXT_CAPABILITY = 'lists';

export type CreateCommandDispatcherOptions = {
  capabilities: Record<string, CapabilityHandler>;
};

export function createCommandDispatcher({ capabilities }: CreateCommandDispatcherOptions) {
  return {
    async dispatch(request: CapabilityRequest): Promise<CapabilityResponse> {
      const capabilityName = request.command ?? FREE_TEXT_CAPABILITY;
      const capability = capabilities[capabilityName];

      if (capability) {
        try {
          return await capability(request);
        } catch {
          return CAPABILITY_FALLBACK_RESPONSE;
        }
      }

      return { kind: 'reply', text: DEFAULT_HELP };
    }
  };
}
