import { describe, expect, it } from 'vitest';

import {
  createOpenAiListItemsProvider,
  listItemsOutputJsonSchema,
  type ListItemsParseProvider,
  parseListItemsMessage
} from './parse';

describe('parseListItemsMessage', () => {
  it('extracts the items the AI provider returns with a null target list', async () => {
    const provider: ListItemsParseProvider = async ({ messageText }) => {
      expect(messageText).toBe('add milk, bread and eggs to the shopping list');
      return { items: ['milk', 'bread', 'eggs'] };
    };

    const result = await parseListItemsMessage({
      messageText: 'add milk, bread and eggs to the shopping list',
      provider
    });

    expect(result).toEqual({ targetListId: null, items: ['milk', 'bread', 'eggs'] });
  });

  it('falls back to a conservative newline split when the AI output is malformed', async () => {
    const provider: ListItemsParseProvider = async () => ({ unexpected: 'shape' });

    const result = await parseListItemsMessage({
      messageText: 'Milk, 2L\nSourdough loaf\n  \nDishwasher tablets',
      provider
    });

    // Conservative: split on newlines only, so "Milk, 2L" stays one item.
    expect(result).toEqual({
      targetListId: null,
      items: ['Milk, 2L', 'Sourdough loaf', 'Dishwasher tablets']
    });
  });

  it('falls back deterministically when the provider throws', async () => {
    const provider: ListItemsParseProvider = async () => {
      throw new Error('AI unavailable');
    };

    const result = await parseListItemsMessage({ messageText: 'batteries', provider });

    expect(result).toEqual({ targetListId: null, items: ['batteries'] });
  });

  it('returns no items when there is nothing usable to capture', async () => {
    const provider: ListItemsParseProvider = async () => ({ items: ['   ', ''] });

    const result = await parseListItemsMessage({ messageText: '   ', provider });

    expect(result).toEqual({ targetListId: null, items: [] });
  });
});

describe('createOpenAiListItemsProvider', () => {
  it('requests a strict structured item list and parses the JSON response', async () => {
    const requests: unknown[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ items: ['milk', 'bread'] }) } }]
        }),
        { status: 200 }
      );
    };

    const provider = createOpenAiListItemsProvider({ apiKey: 'test-key', model: 'test-model', fetchImpl });

    await expect(provider({ messageText: 'add milk and bread' })).resolves.toEqual({ items: ['milk', 'bread'] });
    expect(requests).toMatchObject([
      {
        model: 'test-model',
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'list_items', strict: true, schema: listItemsOutputJsonSchema }
        }
      }
    ]);
  });

  it('throws when the AI request is not ok so the caller can fall back', async () => {
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 500 });
    const provider = createOpenAiListItemsProvider({ apiKey: 'k', model: 'm', fetchImpl });

    await expect(provider({ messageText: 'x' })).rejects.toThrow();
  });
});
