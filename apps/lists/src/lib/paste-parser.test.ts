import { describe, expect, it } from 'vitest';

import { parsePastedItems } from './paste-parser';

describe('parsePastedItems', () => {
  it('splits a flat comma-separated line into one item per value', () => {
    const result = parsePastedItems('bananas, apples, oats, milk');

    expect(result.items).toEqual(['bananas', 'apples', 'oats', 'milk']);
    expect(result.headings).toEqual([]);
  });

  it('keeps a single line with one comma as one item', () => {
    const result = parsePastedItems('Milk, 2L');

    expect(result.items).toEqual(['Milk, 2L']);
    expect(result.headings).toEqual([]);
  });

  it('keeps a plain single word as one item', () => {
    expect(parsePastedItems('bananas').items).toEqual(['bananas']);
  });

  it('splits on newlines and preserves commas inside each line', () => {
    const result = parsePastedItems('Milk, 2L\nbananas\nCall mum, then dad');

    expect(result.items).toEqual(['Milk, 2L', 'bananas', 'Call mum, then dad']);
    expect(result.headings).toEqual([]);
  });

  it('strips trailing list punctuation and drops the empty trailing line', () => {
    const result = parsePastedItems('bananas,\napples,\noats,\nmilk');

    expect(result.items).toEqual(['bananas', 'apples', 'oats', 'milk']);
    expect(result.headings).toEqual([]);
  });

  it('strips leading checkbox and bullet markers', () => {
    const result = parsePastedItems('☐avocados\n- bananas\n* broccoli\n• onions\n– potatoes');

    expect(result.items).toEqual(['avocados', 'bananas', 'broccoli', 'onions', 'potatoes']);
    expect(result.headings).toEqual([]);
  });

  it('strips numbered-list markers', () => {
    const result = parsePastedItems('1. eggs\n2. milk\n3. bread');

    expect(result.items).toEqual(['eggs', 'milk', 'bread']);
  });

  it('treats marker-less lines among marked lines as headings', () => {
    const result = parsePastedItems('Dairy\n☐milk\n☐eggs\nProduce\n☐bananas\n\n☐popping corn');

    expect(result.items).toEqual(['milk', 'eggs', 'bananas', 'popping corn']);
    expect(result.headings).toEqual(['Dairy', 'Produce']);
  });

  it('keeps every line as an item when no line has a marker', () => {
    const result = parsePastedItems('bread\nmilk\noats');

    expect(result.items).toEqual(['bread', 'milk', 'oats']);
    expect(result.headings).toEqual([]);
  });

  it('returns nothing for empty or whitespace-only input', () => {
    expect(parsePastedItems('   \n  ')).toEqual({ items: [], headings: [] });
    expect(parsePastedItems('')).toEqual({ items: [], headings: [] });
  });

  it('parses a real categorised shopping list end to end', () => {
    const result = parsePastedItems(
      [
        'Dairy',
        '☐milk',
        '☐eggs',
        '☐1 sour light cream',
        'Produce',
        '☐avocados',
        '☐brown onions',
        '',
        '☐popping corn'
      ].join('\n')
    );

    expect(result.items).toEqual(['milk', 'eggs', '1 sour light cream', 'avocados', 'brown onions', 'popping corn']);
    expect(result.headings).toEqual(['Dairy', 'Produce']);
  });
});
