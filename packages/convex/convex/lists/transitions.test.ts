import { describe, expect, it } from 'vitest';

import { markActive, markCompleted, nextActiveSortOrder, propertyValuePatch, reorderByIndex } from './transitions';

describe('nextActiveSortOrder', () => {
  it('places a new active item one past the highest existing order, not at the active count', () => {
    // sortOrder 5 leaves a gap after completing/deleting items; placing the new
    // item at the active count (3) would slot it into the gap before order 5.
    expect(nextActiveSortOrder([{ sortOrder: 0 }, { sortOrder: 1 }, { sortOrder: 5 }])).toBe(6);
  });
});

describe('reorderByIndex', () => {
  it('moves an item to the target index and renumbers sortOrder densely', () => {
    const items = [
      { _id: 'a', sortOrder: 0 },
      { _id: 'b', sortOrder: 1 },
      { _id: 'c', sortOrder: 2 }
    ];

    expect(reorderByIndex(items, 'c', 0)).toEqual([
      { _id: 'c', sortOrder: 0 },
      { _id: 'a', sortOrder: 1 },
      { _id: 'b', sortOrder: 2 }
    ]);
  });

  it('clamps a target index past the end to the last position', () => {
    const items = [
      { _id: 'a', sortOrder: 0 },
      { _id: 'b', sortOrder: 1 }
    ];

    expect(reorderByIndex(items, 'a', 99)).toEqual([
      { _id: 'b', sortOrder: 0 },
      { _id: 'a', sortOrder: 1 }
    ]);
  });

  it('returns the collection unchanged when the moved id is unknown', () => {
    const items = [{ _id: 'a', sortOrder: 0 }];
    expect(reorderByIndex(items, 'missing', 0)).toEqual(items);
  });
});

describe('markCompleted', () => {
  it('stamps completedAt and updatedAt at the given time, leaving order untouched', () => {
    const item = { _id: 'x', sortOrder: 3, createdAt: 1, updatedAt: 100 };
    expect(markCompleted(item, 200)).toEqual({
      _id: 'x',
      sortOrder: 3,
      createdAt: 1,
      completedAt: 200,
      updatedAt: 200
    });
  });
});

describe('markActive', () => {
  it('clears completion and places the reopened item one past the highest active order', () => {
    const item = { _id: 'x', sortOrder: 9, createdAt: 1, completedAt: 100, updatedAt: 100 };
    // active orders [0, 5] → max+1 = 6, not the active count (2).
    const activeItems = [{ sortOrder: 0 }, { sortOrder: 5 }];

    expect(markActive(item, activeItems, 200)).toEqual({
      _id: 'x',
      sortOrder: 6,
      createdAt: 1,
      completedAt: undefined,
      updatedAt: 200
    });
  });
});

describe('propertyValuePatch', () => {
  it('maps a typed payload to the matching value field', () => {
    expect(propertyValuePatch({ type: 'text' }, { type: 'text', text: 'Dairy' })).toEqual({ textValue: 'Dairy' });
    expect(propertyValuePatch({ type: 'number' }, { type: 'number', number: 2 })).toEqual({ numberValue: 2 });
    expect(propertyValuePatch({ type: 'checkbox' }, { type: 'checkbox', checked: true })).toEqual({
      checkboxValue: true
    });
  });

  it('rejects a payload whose type does not match the property', () => {
    expect(() => propertyValuePatch({ type: 'number' }, { type: 'text', text: 'x' })).toThrow();
  });

  it('maps a valid select option but rejects one not defined on the property', () => {
    const property = { type: 'select' as const, options: [{ id: 'high', label: 'High' }] };
    expect(propertyValuePatch(property, { type: 'select', optionId: 'high' })).toEqual({ selectOptionId: 'high' });
    expect(() => propertyValuePatch(property, { type: 'select', optionId: 'low' })).toThrow();
  });
});
