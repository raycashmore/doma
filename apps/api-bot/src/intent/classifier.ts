import type { IntentDescriptorRegistry } from './registry.js';
import { NO_CAPABILITY } from './registry.js';

/**
 * The structured input the router asks the classifier provider to label. The
 * router only PICKS a capability; it never parses the message content. Deep
 * understanding (item parsing, day resolution) is the chosen capability's job.
 */
export type IntentClassifierInput = {
  messageText: string;
  prompt: string;
};

/**
 * An injected classifier provider. Unit tests pass a fake (no network); the
 * real provider is wired separately. The provider returns an unknown shape so
 * the router can apply its own deterministic parse-and-fallback.
 */
export type IntentClassifierProvider = (input: IntentClassifierInput) => Promise<unknown>;

/** The router's routing decision: exactly one capability name, or `none`. */
export type IntentClassification = {
  capability: string;
};

const DEFAULT_MIN_CONFIDENCE = 0.5;
const MAX_CONFIDENCE = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
}

/**
 * Build the classify-only router prompt from the registered intent descriptors.
 * The prompt enumerates each capability's name, description and examples and
 * instructs the model to pick exactly one capability name or `none` — never to
 * parse or transform the message content.
 */
export function buildIntentRouterPrompt(descriptors: IntentDescriptorRegistry): string {
  const capabilityBlocks = descriptors.map((descriptor) => {
    const examples = descriptor.examples.map((example) => `  - ${example}`).join('\n');
    return [`- ${descriptor.name}: ${descriptor.description}`, '  Examples:', examples].join('\n');
  });

  return [
    'You are an intent router for a household assistant bot.',
    'Pick exactly one capability that should handle the user message, or none.',
    'You only PICK a capability. Do NOT parse, rewrite, summarise, or extract items from the message; the chosen capability does its own understanding.',
    `If no capability clearly fits, or you are unsure, return "${NO_CAPABILITY}".`,
    '',
    'Capabilities:',
    ...capabilityBlocks,
    '',
    `Return one of: ${descriptors.map((descriptor) => descriptor.name).join(', ')}, ${NO_CAPABILITY}.`
  ].join('\n');
}

/**
 * The strict JSON-schema-style response contract for the router. The capability
 * is constrained to the registered names plus `none`, mirroring the briefing AI
 * module's strict structured-output approach.
 */
export function intentRouterOutputJsonSchema(descriptors: IntentDescriptorRegistry) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['capability', 'confidence'],
    properties: {
      capability: {
        type: 'string',
        enum: [...descriptors.map((descriptor) => descriptor.name), NO_CAPABILITY]
      },
      confidence: { type: 'number' }
    }
  } as const;
}

function parseClassifierResponse(
  value: unknown,
  knownCapabilities: Set<string>,
  minConfidence: number
): IntentClassification {
  if (!isRecord(value) || typeof value.capability !== 'string') {
    return { capability: NO_CAPABILITY };
  }

  if (value.capability === NO_CAPABILITY || !knownCapabilities.has(value.capability)) {
    return { capability: NO_CAPABILITY };
  }

  // A mutating capability must only be reached on a valid confidence signal.
  // Reject missing, non-numeric, non-finite, or out-of-range values so a
  // provider or schema regression cannot route without one.
  const { confidence } = value;
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < minConfidence ||
    confidence > MAX_CONFIDENCE
  ) {
    return { capability: NO_CAPABILITY };
  }

  return { capability: value.capability };
}

/**
 * Classify a free-text message to exactly one registered capability or `none`.
 * Pure aside from the injected provider: builds the prompt, asks the provider,
 * then deterministically parses the result, falling back to `none` on malformed
 * output, an unregistered capability, low confidence, or a provider failure.
 */
export async function classifyIntent({
  messageText,
  descriptors,
  provider,
  minConfidence = DEFAULT_MIN_CONFIDENCE
}: {
  messageText: string;
  descriptors: IntentDescriptorRegistry;
  provider: IntentClassifierProvider;
  minConfidence?: number;
}): Promise<IntentClassification> {
  const prompt = buildIntentRouterPrompt(descriptors);
  const knownCapabilities = new Set(descriptors.map((descriptor) => descriptor.name));

  try {
    const response = await provider({ messageText, prompt });
    return parseClassifierResponse(response, knownCapabilities, minConfidence);
  } catch (error) {
    console.error('[api-bot.intent] Falling back to none after intent classifier failure', {
      error: serializeError(error)
    });
    return { capability: NO_CAPABILITY };
  }
}
