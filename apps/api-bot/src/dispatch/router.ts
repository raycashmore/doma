import type {
  CapabilityHandler,
  CapabilityRequest,
  CapabilityResponse
} from './types.js';
import { CAPABILITY_FALLBACK_RESPONSE } from './types.js';

export const DEFAULT_HELP = 'I can help with scheduling soon. Try /schedule.';

export type CreateCommandDispatcherOptions = {
  capabilities: Record<string, CapabilityHandler>;
};

export function createCommandDispatcher({
  capabilities
}: CreateCommandDispatcherOptions) {
  return {
    async dispatch(request: CapabilityRequest): Promise<CapabilityResponse> {
      const capability = request.command
        ? capabilities[request.command]
        : undefined;

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
