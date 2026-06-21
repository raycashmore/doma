import type { IntentDescriptorRegistry } from '../intent/registry.js';
import { defaultIntentDescriptors, NO_CAPABILITY } from '../intent/registry.js';
import type { CapabilityHandler, CapabilityRequest, CapabilityResponse } from './types.js';
import { CAPABILITY_FALLBACK_RESPONSE } from './types.js';

export const DEFAULT_HELP = 'I can help with scheduling soon. Try /schedule.';

/**
 * The router's classify-only contract: given the free-text message, decide which
 * single capability should handle it (or `none`). The dispatcher injects this so
 * unit tests use a fake (no network) and the real LLM provider is wired
 * separately. The router only PICKS; the chosen capability does its own parsing.
 */
export type RouteClassifier = (messageText: string) => Promise<{ capability: string }>;

/**
 * Build the short capabilities hint shown when a free-text message routes to
 * `none`. It teaches the user what the bot can do and creates nothing.
 */
export function buildCapabilitiesHint(descriptors: IntentDescriptorRegistry = defaultIntentDescriptors): string {
  const lines = descriptors.map((descriptor) => `• ${descriptor.name} — ${descriptor.description}`);
  return ['I am not sure what you meant. I can help with:', ...lines].join('\n');
}

export type CreateCommandDispatcherOptions = {
  capabilities: Record<string, CapabilityHandler>;
  /**
   * Routes free-text (non-slash) messages to a capability. When omitted, the bot
   * has no intent router configured and replies with the capabilities hint
   * rather than guessing.
   */
  classify?: RouteClassifier;
  descriptors?: IntentDescriptorRegistry;
};

export function createCommandDispatcher({
  capabilities,
  classify,
  descriptors = defaultIntentDescriptors
}: CreateCommandDispatcherOptions) {
  async function runCapability(capabilityName: string, request: CapabilityRequest): Promise<CapabilityResponse> {
    const capability = capabilities[capabilityName];

    if (!capability) {
      return { kind: 'reply', text: DEFAULT_HELP };
    }

    try {
      return await capability(request);
    } catch {
      return CAPABILITY_FALLBACK_RESPONSE;
    }
  }

  return {
    async dispatch(request: CapabilityRequest): Promise<CapabilityResponse> {
      // Slash commands bypass the router entirely: dispatch directly with no LLM
      // call. The webhook has already parsed `command` from the leading `/word`.
      if (request.command) {
        return runCapability(request.command, request);
      }

      // Free-text is classified to exactly one capability or `none`.
      if (!classify) {
        return { kind: 'reply', text: buildCapabilitiesHint(descriptors) };
      }

      const { capability } = await classify(request.messageText);

      if (capability === NO_CAPABILITY || !capabilities[capability]) {
        return { kind: 'reply', text: buildCapabilitiesHint(descriptors) };
      }

      return runCapability(capability, request);
    }
  };
}
