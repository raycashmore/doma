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

  it('falls back to a newline split for multi-line input when the provider throws', async () => {
    const provider: ListItemsParseProvider = async () => {
      throw new Error('AI unavailable');
    };

    const result = await parseListItemsMessage({ messageText: 'batteries\nlightbulbs', provider });

    expect(result).toEqual({ targetListId: null, items: ['batteries', 'lightbulbs'] });
  });

  it('captures nothing for single-line input when the AI is unavailable', async () => {
    // Without AI we cannot tell a real item ("batteries") from chatter ("hello"),
    // so a single line yields no items rather than a verbatim, possibly-junk item.
    const provider: ListItemsParseProvider = async () => {
      throw new Error('AI unavailable');
    };

    await expect(parseListItemsMessage({ messageText: 'add milk to the shopping list', provider })).resolves.toEqual({
      targetListId: null,
      items: []
    });
    await expect(parseListItemsMessage({ messageText: 'hello', provider })).resolves.toEqual({
      targetListId: null,
      items: []
    });
  });

  it('returns no items when there is nothing usable to capture', async () => {
    const provider: ListItemsParseProvider = async () => ({ items: ['   ', ''] });

    const result = await parseListItemsMessage({ messageText: '   ', provider });

    expect(result).toEqual({ targetListId: null, items: [] });
  });

  it('bounds the number of items and the length of each title', async () => {
    const provider: ListItemsParseProvider = async () => ({
      items: [`${'a'.repeat(500)}`, ...Array.from({ length: 200 }, (_, index) => `item ${index}`)]
    });

    const result = await parseListItemsMessage({ messageText: 'lots', provider });

    expect(result.items.length).toBeLessThanOrEqual(50);
    expect(Math.max(...result.items.map((item) => item.length))).toBeLessThanOrEqual(200);
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
