export type ListItemsParseInput = { messageText: string };

export type ListItemsParseProvider = (input: ListItemsParseInput) => Promise<unknown>;

export type ParsedListItems = { targetListId: null; items: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const listItemsSystemPrompt = [
  'You extract list items from a short household message for a shopping/todo list.',
  'Return only the item titles the user wants to capture, in the order they appear.',
  'Split distinct things into separate items, but keep a single item whole when commas describe one thing (e.g. "Milk, 2L").',
  'Use concise plain titles. Do not invent items, quantities, notes, or list names.',
  'If the message names a list or contains chatter like "add ... to the list", capture only the items, not the framing words.',
  'Return only the requested structured object.'
].join('\n');

export const listItemsOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: { type: 'array', items: { type: 'string' } }
  }
} as const;

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
  return async ({ messageText }) => {
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
          { role: 'user', content: messageText }
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
 * Parse a structured AI response into a list of item titles. Returns null when
 * the response is not the expected `{ items: string[] }` shape so the caller can
 * fall back deterministically.
 */
export function parseListItemsAiResponse(value: unknown): { items: string[] } | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  if (!value.items.every((item) => typeof item === 'string')) return null;
  return { items: value.items as string[] };
}

/**
 * Deterministic fallback used when the AI is unavailable or returns something
 * unusable. Splits on newlines only, so a single line like "Milk, 2L" is kept
 * as one item rather than mangled. This is intentionally independent of the
 * in-app composer paste-split heuristic (ADR-0001), which is not shared across
 * the HTTP boundary.
 */
export function deterministicListItems(messageText: string): string[] {
  return cleanItems(messageText.split('\n'));
}

export async function parseListItemsMessage({
  messageText,
  provider
}: {
  messageText: string;
  provider: ListItemsParseProvider | null;
}): Promise<ParsedListItems> {
  let items: string[] | null = null;

  if (provider) {
    try {
      const parsed = parseListItemsAiResponse(await provider({ messageText }));
      items = parsed ? cleanItems(parsed.items) : null;
    } catch {
      items = null;
    }
  }

  return {
    targetListId: null,
    items: items ?? deterministicListItems(messageText)
  };
}
