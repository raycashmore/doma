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
    expect(parsePastedItems('   \n  ')).toEqual({ entries: [], items: [], headings: [] });
    expect(parsePastedItems('')).toEqual({ entries: [], items: [], headings: [] });
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

  it('splits a flat checkbox list with no newlines', () => {
    const result = parsePastedItems('☐ milk ☐ eggs ☐ bread');

    expect(result.items).toEqual(['milk', 'eggs', 'bread']);
    expect(result.headings).toEqual([]);
  });

  it('splits a flat checkbox list with glued glyphs', () => {
    expect(parsePastedItems('☐milk ☐eggs').items).toEqual(['milk', 'eggs']);
  });

  it('splits a flat bullet list, stripping markers and trailing commas', () => {
    const result = parsePastedItems('- milk, - eggs, - bread');

    expect(result.items).toEqual(['milk', 'eggs', 'bread']);
    expect(result.headings).toEqual([]);
  });

  it('splits a flat numbered list with no newlines', () => {
    expect(parsePastedItems('1. eggs 2. milk 3. bread').items).toEqual(['eggs', 'milk', 'bread']);
  });

  it('does not split a flat marker-less comma item under the comma threshold', () => {
    expect(parsePastedItems('Milk, 2L').items).toEqual(['Milk, 2L']);
  });

  it('returns ordered entries with headings in their original positions', () => {
    const result = parsePastedItems('Dairy\n☐milk\nProduce\n☐avocados');

    expect(result.entries).toEqual([
      { kind: 'heading', text: 'Dairy' },
      { kind: 'item', text: 'milk' },
      { kind: 'heading', text: 'Produce' },
      { kind: 'item', text: 'avocados' }
    ]);
  });
});
