export type AddressableList = { id: string; name: string };

export type ListItemsParseInput = {
  messageText: string;
  addressableLists?: AddressableList[];
  defaultListId?: string | null;
};

export type ListItemsParseProvider = (input: ListItemsParseInput) => Promise<unknown>;

// targetListId is a list publicId from the addressable set (so it survives a
// rename), or null when the message names no resolvable list. requestedListName
// is the list name the user referenced, present whenever the message named a
// list — even one that did not resolve — so the bot can explain a fallback.
export type ParsedListItems = { targetListId: string | null; requestedListName?: string; items: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const listItemsSystemPrompt = [
  'You extract list items from a short household message for a shopping/todo list.',
  'Return only the item titles the user wants to capture, in the order they appear.',
  'Split distinct things into separate items, but keep a single item whole when commas describe one thing (e.g. "Milk, 2L").',
  'Use concise plain titles. Do not invent items, quantities, notes, or list names.',
  'If the message names a list or contains chatter like "add ... to the list", capture only the items, not the framing words.',
  'The user message includes the lists you may target, each with an id and name.',
  "If the message names one of those lists, set targetListId to that list's id; otherwise set targetListId to null.",
  'Never invent a targetListId that is not in the provided lists.',
  'If the message names or describes a target list, set requestedListName to the list name the user referenced (even if it is not in the provided lists); otherwise set it to null.',
  'Return only the requested structured object.'
].join('\n');

export const listItemsOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'targetListId', 'requestedListName'],
  properties: {
    items: { type: 'array', items: { type: 'string' } },
    targetListId: { type: ['string', 'null'] },
    requestedListName: { type: ['string', 'null'] }
  }
} as const;

function listsContextForPrompt(addressableLists: AddressableList[], defaultListId: string | null | undefined): string {
  if (addressableLists.length === 0) return 'Lists you may target: (none).';
  const lines = addressableLists.map(
    (list) => `- id: ${list.id}, name: ${list.name}${list.id === defaultListId ? ' (default)' : ''}`
  );
  return ['Lists you may target:', ...lines].join('\n');
}

function openAiMessageContent(body: unknown): string | null {
  if (!isRecord(body) || !Array.isArray(body.choices)) return null;
  const firstChoice = body.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
  return typeof firstChoice.message.content === 'string' ? firstChoice.message.content : null;
}

export function createOpenAiListItemsProvider({
  apiKey,
  model,
  fetchImpl = fetch
}: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): ListItemsParseProvider {
  return async ({ messageText, addressableLists = [], defaultListId = null }) => {
    const userContent = [listsContextForPrompt(addressableLists, defaultListId), '', `Message: ${messageText}`].join(
      '\n'
    );
    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: listItemsSystemPrompt },
          { role: 'user', content: userContent }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'list_items',
            strict: true,
            schema: listItemsOutputJsonSchema
          }
        }
      })
    });
    if (!response.ok) {
      throw new Error(`List items AI request failed with status ${response.status}`);
    }
    const content = openAiMessageContent((await response.json()) as unknown);
    if (!content) throw new Error('List items AI response did not include JSON content');
    return JSON.parse(content) as unknown;
  };
}

function cleanItems(items: string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

/**
 * Parse a structured AI response into item titles and an optional target list
 * id. Returns null when the response is not the expected shape so the caller can
 * fall back deterministically. `targetListId` is whatever the model returned; it
 * is validated against the addressable set by the caller.
 */
export function parseListItemsAiResponse(
  value: unknown
): { items: string[]; targetListId: string | null; requestedListName: string | null } | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  if (!value.items.every((item) => typeof item === 'string')) return null;
  const targetListId = typeof value.targetListId === 'string' ? value.targetListId : null;
  const requestedListName = typeof value.requestedListName === 'string' ? value.requestedListName : null;
  return { items: value.items as string[], targetListId, requestedListName };
}

// Guard rails applied to every parsed result before it can reach a mutation.
export const MAX_LIST_ITEMS = 50;
export const MAX_LIST_ITEM_TITLE_LENGTH = 200;

function boundItems(items: string[]): string[] {
  return items.slice(0, MAX_LIST_ITEMS).map((item) => item.slice(0, MAX_LIST_ITEM_TITLE_LENGTH));
}

/**
 * Deterministic fallback used when the AI is unavailable or returns something
 * unusable. Only handles the multi-line paste case (split on newlines, so a
 * line like "Milk, 2L" stays one item). A single line is returned as no items:
 * without the AI we cannot distinguish a real item ("batteries") from chatter
 * ("hello") or strip framing words ("add milk to the shopping list"), so we
 * decline rather than capture a verbatim, possibly-junk item. This is
 * intentionally independent of the in-app composer paste-split heuristic
 * (ADR-0001), which is not shared across the HTTP boundary.
 */
export function deterministicListItems(messageText: string): string[] {
  if (!messageText.includes('\n')) return [];
  return cleanItems(messageText.split('\n'));
}

export async function parseListItemsMessage({
  messageText,
  provider,
  addressableLists = [],
  defaultListId = null
}: {
  messageText: string;
  provider: ListItemsParseProvider | null;
  addressableLists?: AddressableList[];
  defaultListId?: string | null;
}): Promise<ParsedListItems> {
  let items: string[] | null = null;
  let targetListId: string | null = null;
  let requestedListName: string | null = null;

  if (provider) {
    try {
      const parsed = parseListItemsAiResponse(await provider({ messageText, addressableLists, defaultListId }));
      items = parsed ? cleanItems(parsed.items) : null;
      // Only trust an id that names a real addressable list; this survives a
      // rename because we match on id, not on the message's wording.
      if (parsed?.targetListId && addressableLists.some((list) => list.id === parsed.targetListId)) {
        targetListId = parsed.targetListId;
      }
      const trimmedName = parsed?.requestedListName?.trim();
      requestedListName = trimmedName ? trimmedName : null;
    } catch {
      items = null;
    }
  }

  // Only surface a requested name when the user named a list we could not
  // resolve, so the caller can explain a fallback to the default list.
  return {
    targetListId,
    ...(targetListId === null && requestedListName ? { requestedListName } : {}),
    items: boundItems(items ?? deterministicListItems(messageText))
  };
}
