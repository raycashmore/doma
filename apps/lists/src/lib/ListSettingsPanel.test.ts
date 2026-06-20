import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { VisibleListProperty } from '$lib/lists-presenter';

vi.mock('svelte-dnd-action', () => ({
  dragHandle(node: HTMLElement) {
    node.dataset.dragHandle = 'true';
  },
  dragHandleZone(node: HTMLElement) {
    node.dataset.dragHandleZone = 'true';
  }
}));

const properties: VisibleListProperty[] = [
  { _id: 'priority', listId: 'list', name: 'Priority', type: 'select', sortOrder: 0 },
  { _id: 'aisle', listId: 'list', name: 'Aisle', type: 'text', sortOrder: 1 }
];

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(async () => {
  await Promise.all(mounted.splice(0).map((component) => unmount(component)));
  document.body.innerHTML = '';
});

function renderPanel(onReorder = vi.fn(async () => true)) {
  const target = document.body.appendChild(document.createElement('div'));
  const component = mount(ListSettingsPanel, {
    target,
    props: {
      properties,
      error: null,
      onClose: vi.fn(),
      onReorder,
      propertyRenameId: null,
      propertyRenameName: '',
      setPropertyRenameName: vi.fn(),
      beginRename: vi.fn(),
      cancelRename: vi.fn(),
      onSaveRename: vi.fn(),
      pendingRemoveId: null,
      requestRemove: vi.fn(),
      cancelRemove: vi.fn(),
      onConfirmRemove: vi.fn(),
      draftName: '',
      setDraftName: vi.fn(),
      draftType: 'text',
      setDraftType: vi.fn(),
      draftOptions: '',
      setDraftOptions: vi.fn(),
      onCreate: vi.fn(),
      propertyTypeLabel: (type: VisibleListProperty['type']) => type
    }
  });
  mounted.push(component);
  return target;
}

function propertyNames(target: HTMLElement) {
  return [...target.querySelectorAll('li')].map((row) => row.querySelector('p')?.textContent?.trim());
}

describe('ListSettingsPanel reordering', () => {
  it('enables dragging only through property handles', async () => {
    const target = renderPanel();
    await tick();

    expect(target.querySelector('ul')?.dataset.dragHandleZone).toBe('true');
    expect(target.querySelectorAll('[data-drag-handle="true"]')).toHaveLength(properties.length);
    expect(target.querySelector<HTMLElement>('[aria-label="Drag to reorder Priority"]')?.dataset.dragHandle).toBe(
      'true'
    );
  });

  it('rolls an optimistic order back when persistence fails', async () => {
    const onReorder = vi.fn(async () => false);
    const target = renderPanel(onReorder);
    await tick();
    const list = target.querySelector('ul');
    expect(list).not.toBeNull();

    list?.dispatchEvent(
      new CustomEvent('finalize', {
        detail: {
          items: [
            { id: 'aisle', property: properties[1] },
            { id: 'priority', property: properties[0] }
          ],
          info: { id: 'aisle' }
        }
      })
    );

    await vi.waitFor(() => expect(onReorder).toHaveBeenCalledWith('aisle', 0));
    await vi.waitFor(() => expect(propertyNames(target)).toEqual(['Priority', 'Aisle']));
  });
});

import ListSettingsPanel from '$lib/ListSettingsPanel.svelte';
