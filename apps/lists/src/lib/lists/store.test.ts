import { describe, expect, it } from 'vitest';

import { previewItemsByListPublicId, previewVisibleLists } from './presenter';
import { InMemoryListStore } from './store.svelte';

function makeStore(selectedPublicId: string | null = null) {
  let selected = selectedPublicId;
  const store = new InMemoryListStore({
    getSelectedPublicId: () => selected,
    seedLists: previewVisibleLists,
    seedItemsByListPublicId: previewItemsByListPublicId
  });
  return {
    store,
    select(id: string | null) {
      selected = id;
    }
  };
}

describe('InMemoryListStore reads', () => {
  it('exposes seeded lists and the selected list data', () => {
    const { store } = makeStore('weekly-shop');
    expect(store.lists.map((list) => list.publicId)).toContain('weekly-shop');
    expect(store.selected?.list.publicId).toBe('weekly-shop');
  });
});

describe('InMemoryListStore completion', () => {
  it('moves a completed item out of the active order and leaves a gap, mirroring the backend', async () => {
    // weekly-shop active items: Bananas(0), Milk(1), Bread(2).
    const { store } = makeStore('weekly-shop');

    await store.completeItem({ itemId: 'preview-item-milk' });

    const active = store.selected!.activeItems;
    expect(active.map((item) => item.title)).toEqual(['Bananas', 'Bread']);
    // Gap at 1 is preserved, not renumbered to [0, 1] — matches Convex.
    expect(active.map((item) => item.sortOrder)).toEqual([0, 2]);
    expect(store.selected!.completedItems.map((item) => item.title)).toContain('Milk');
  });
});

describe('InMemoryListStore active item order', () => {
  it('adds a new item one past the highest active order, even after a gap forms', async () => {
    const { store } = makeStore('weekly-shop');
    await store.completeItem({ itemId: 'preview-item-bananas' }); // removes order 0, active now [1, 2]

    await store.createItem({ listPublicId: 'weekly-shop', title: 'Eggs' });

    const eggs = store.selected!.activeItems.find((item) => item.title === 'Eggs')!;
    expect(eggs.sortOrder).toBe(3); // max(1, 2) + 1 — not the active count (2)
  });

  it('reopens a completed item to the end of the active order', async () => {
    const { store } = makeStore('weekly-shop');
    await store.completeItem({ itemId: 'preview-item-bananas' }); // active [1, 2], Bananas completed

    await store.uncompleteItem({ itemId: 'preview-item-bananas' });

    const bananas = store.selected!.activeItems.find((item) => item.title === 'Bananas')!;
    expect(bananas.sortOrder).toBe(3); // appended past the highest, not back at 0
    expect(store.selected!.completedItems.map((item) => item.title)).not.toContain('Bananas');
  });
});

describe('InMemoryListStore list lifecycle', () => {
  it('creates a list with a slugified route target and makes it selectable', async () => {
    const { store, select } = makeStore(null);

    const target = await store.createList({ name: 'Weekend Trip', visibility: 'personal' });

    expect(target.slug).toBe('weekend-trip');
    // Public id is opaque, not the slug (so duplicate names cannot collide).
    expect(target.publicId).not.toBe('weekend-trip');
    expect(store.lists.map((list) => list.publicId)).toContain(target.publicId);
    select(target.publicId);
    expect(store.selected?.list.name).toBe('Weekend Trip');
  });

  it('keeps two lists with the same name as distinct identities', async () => {
    const { store } = makeStore(null);

    const first = await store.createList({ name: 'Weekly shop', visibility: 'shared' });
    await store.createItem({ listPublicId: first.publicId, title: 'Eggs' });
    const second = await store.createList({ name: 'Weekly shop', visibility: 'shared' });

    expect(second.publicId).not.toBe(first.publicId);
    expect(second.slug).toBe(first.slug);
    // The first list's data survives — the second did not overwrite it.
    const firstData = store.lists.filter((list) => list.publicId === first.publicId);
    expect(firstData).toHaveLength(1);
  });

  it('renames a list and reslugs it', async () => {
    const { store } = makeStore('weekly-shop');

    const target = await store.renameList({ publicId: 'weekly-shop', name: 'Fortnightly Shop' });

    expect(target.slug).toBe('fortnightly-shop');
    expect(store.lists.find((list) => list.publicId === 'weekly-shop')?.name).toBe('Fortnightly Shop');
  });
});

describe('InMemoryListStore parity with the backend', () => {
  it('throws unavailable-resource errors instead of silently succeeding', async () => {
    const { store } = makeStore('weekly-shop');

    await expect(store.deleteItem({ itemId: 'missing-item' })).rejects.toThrow('List item unavailable');
    await expect(store.createItem({ listPublicId: 'missing-list', title: 'X' })).rejects.toThrow('List unavailable');
    await expect(store.renameProperty({ propertyId: 'missing-prop', name: 'X' })).rejects.toThrow(
      'List property unavailable'
    );
    await expect(
      store.setPropertyValue({
        itemId: 'preview-item-bread',
        propertyId: 'missing-prop',
        value: { type: 'text', text: 'x' }
      })
    ).rejects.toThrow('List property unavailable');
  });

  it('stamps the item updatedAt when a property value changes', async () => {
    const { store } = makeStore('weekly-shop');
    const before = store.selected!.activeItems.find((item) => item.title === 'Bread')!.updatedAt;

    await store.setPropertyValue({
      itemId: 'preview-item-bread',
      propertyId: 'preview-property-aisle',
      value: { type: 'text', text: 'Bakery' }
    });

    const after = store.selected!.activeItems.find((item) => item.title === 'Bread')!.updatedAt;
    expect(after).toBeGreaterThanOrEqual(before);
    expect(after).not.toBe(before);
  });
});

describe('InMemoryListStore deleteItem', () => {
  it('removes an item without renumbering the survivors', async () => {
    const { store } = makeStore('weekly-shop'); // Bananas(0), Milk(1), Bread(2)

    await store.deleteItem({ itemId: 'preview-item-milk' });

    const active = store.selected!.activeItems;
    expect(active.map((item) => item.title)).toEqual(['Bananas', 'Bread']);
    expect(active.map((item) => item.sortOrder)).toEqual([0, 2]); // gap preserved, matches Convex
  });
});

describe('InMemoryListStore reorderItem', () => {
  it('moves an item to the target index and renumbers densely', async () => {
    const { store } = makeStore('weekly-shop');

    await store.reorderItem({ itemId: 'preview-item-bread', targetIndex: 0 });

    expect(store.selected!.activeItems.map((item) => [item.title, item.sortOrder])).toEqual([
      ['Bread', 0],
      ['Bananas', 1],
      ['Milk', 2]
    ]);
  });
});

describe('InMemoryListStore property values', () => {
  it('keeps assignments when a Select option label changes', async () => {
    const { store } = makeStore('weekly-shop');

    await store.setPropertyValue({
      itemId: 'preview-item-bread',
      propertyId: 'preview-property-priority',
      value: { type: 'select', optionId: 'high' }
    });
    await store.replacePropertyOptions({
      propertyId: 'preview-property-priority',
      options: [
        { id: 'high', label: 'Urgent' },
        { id: 'low', label: 'Later' }
      ]
    });

    const bread = store.selected!.activeItems.find((item) => item._id === 'preview-item-bread')!;
    const priority = store.selected!.properties.find((property) => property._id === 'preview-property-priority')!;
    expect(priority.options?.[0]).toEqual({ id: 'high', label: 'Urgent' });
    expect(bread.propertyValues.find((value) => value.listPropertyId === priority._id)?.selectOptionId).toBe('high');
  });

  it('adds a typed value to an item that had none', async () => {
    const { store } = makeStore('weekly-shop');

    await store.setPropertyValue({
      itemId: 'preview-item-bread',
      propertyId: 'preview-property-aisle',
      value: { type: 'text', text: 'Bakery' }
    });

    const bread = store.selected!.activeItems.find((item) => item.title === 'Bread')!;
    expect(bread.propertyValues.find((value) => value.listPropertyId === 'preview-property-aisle')?.textValue).toBe(
      'Bakery'
    );
  });

  it('replaces an existing value rather than duplicating it', async () => {
    const { store } = makeStore('weekly-shop'); // Milk already has Aisle = 'Dairy'

    await store.setPropertyValue({
      itemId: 'preview-item-milk',
      propertyId: 'preview-property-aisle',
      value: { type: 'text', text: 'Fridge' }
    });

    const milk = store.selected!.activeItems.find((item) => item.title === 'Milk')!;
    const aisleValues = milk.propertyValues.filter((value) => value.listPropertyId === 'preview-property-aisle');
    expect(aisleValues).toHaveLength(1);
    expect(aisleValues[0]?.textValue).toBe('Fridge');
  });
});
