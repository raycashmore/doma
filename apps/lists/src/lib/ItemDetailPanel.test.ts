import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ItemDetailPanel from '$lib/ItemDetailPanel.svelte';
import type { VisibleListItem } from '$lib/lists-presenter';

const item: VisibleListItem = {
  _id: 'item',
  listId: 'list',
  title: 'Generic item',
  notes: 'Original note',
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1,
  propertyValues: []
};

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(async () => {
  await Promise.all(mounted.splice(0).map((component) => unmount(component)));
  document.body.innerHTML = '';
});

function renderPanel(overrides: Record<string, unknown> = {}) {
  const target = document.body.appendChild(document.createElement('div'));
  const props = {
    item,
    properties: [],
    completed: false,
    error: null,
    onClose: vi.fn(),
    onRename: vi.fn(),
    onSaveNotes: vi.fn(),
    onToggleComplete: vi.fn(),
    onDelete: vi.fn(),
    valueEditorPropertyId: null,
    openValueEditor: vi.fn(),
    resetValueEditor: vi.fn(),
    onSaveValue: vi.fn(),
    onClearValue: vi.fn(),
    valueDraftText: '',
    valueDraftNumber: '',
    valueDraftDate: '',
    valueDraftSelectOptionId: '',
    valueDraftCheckbox: false,
    setValueDraftText: vi.fn(),
    setValueDraftNumber: vi.fn(),
    setValueDraftDate: vi.fn(),
    setValueDraftSelectOptionId: vi.fn(),
    setValueDraftCheckbox: vi.fn(),
    describePropertyValue: vi.fn(),
    findPropertyValue: vi.fn(() => null),
    ...overrides
  };
  const component = mount(ItemDetailPanel, { target, props });
  mounted.push(component);
  return { target, props };
}

describe('ItemDetailPanel', () => {
  it('completes an active item', async () => {
    const onToggleComplete = vi.fn();
    const { target } = renderPanel({ onToggleComplete });
    await tick();

    [...target.querySelectorAll('button')].find((button) => button.textContent?.includes('Complete'))?.click();

    expect(onToggleComplete).toHaveBeenCalledOnce();
  });

  it('reopens a completed item', async () => {
    const onToggleComplete = vi.fn();
    const { target } = renderPanel({ completed: true, onToggleComplete });
    await tick();

    [...target.querySelectorAll('button')].find((button) => button.textContent?.includes('Reopen'))?.click();

    expect(onToggleComplete).toHaveBeenCalledOnce();
  });

  it('saves edited notes on blur', async () => {
    const onSaveNotes = vi.fn();
    const { target } = renderPanel({ onSaveNotes });
    await tick();
    const notes = target.querySelector('textarea')!;

    notes.value = 'Updated generic note';
    notes.dispatchEvent(new InputEvent('input', { bubbles: true }));
    notes.dispatchEvent(new FocusEvent('blur'));

    expect(onSaveNotes).toHaveBeenCalledWith('Updated generic note');
  });
});
