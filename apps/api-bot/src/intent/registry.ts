/**
 * An intent descriptor is the single registration unit a capability adds so the
 * LLM intent router can route free-text messages to it. Registering a new
 * capability with the router requires only adding one of these.
 */
export type IntentDescriptor = {
  /** The capability name the router resolves to (must match a registered handler). */
  name: string;
  /** A short, human-readable description of what the capability does. */
  description: string;
  /** Representative free-text examples that should route to this capability. */
  examples: string[];
};

/**
 * The capability the router picks when it cannot confidently match any
 * registered descriptor. Capabilities never register this name; it is the
 * router's explicit "do nothing" outcome.
 */
export const NO_CAPABILITY = 'none' as const;

export type IntentDescriptorRegistry = readonly IntentDescriptor[];

/**
 * The default intent descriptors for the bot's capabilities. The router only
 * PICKS one of these; each capability does its own deep understanding (lists
 * parses items itself, schedule/briefing parse their own asks).
 */
export const defaultIntentDescriptors: IntentDescriptorRegistry = [
  {
    name: 'lists',
    description:
      'Capture or add items to a shopping or to-do list, e.g. groceries, errands, or things to remember to buy or do.',
    examples: [
      'add milk and eggs',
      "we're out of bread",
      'remember to buy batteries',
      'put bananas, apples and oats on the shopping list'
    ]
  },
  {
    name: 'schedule',
    description:
      "Ask about the household calendar or what is on for a given day, e.g. today's or a future day's events and timings.",
    examples: [
      "what's on today",
      'what does tomorrow look like',
      'do we have anything on this weekend',
      'when is the school pickup'
    ]
  },
  {
    name: 'briefing',
    description:
      'Ask for the morning briefing: a household readiness summary of what to wear, bring, prepare, or remember today.',
    examples: ['morning briefing', 'what do we need to remember today', "give me today's briefing"]
  }
];
