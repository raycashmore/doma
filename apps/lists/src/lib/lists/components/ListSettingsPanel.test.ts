import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { VisibleList, VisibleListProperty } from '$lib/lists/presenter';

vi.mock('svelte-dnd-action', () => ({
  dragHandle(node: HTMLElement) {
    node.dataset.dragHandle = 'true';
  },
  dragHandleZone(node: HTMLElement) {
    node.dataset.dragHandleZone = 'true';
  }
}));

const properties: VisibleListProperty[] = [
  {
    _id: 'priority',
    listId: 'list',
    name: 'Priority',
    type: 'select',
    sortOrder: 0,
    categorisationInstruction: 'Group by priority.'
  },
  {
    _id: 'aisle',
    listId: 'list',
    name: 'Aisle',
    type: 'select',
    sortOrder: 1,
    options: [{ id: 'bread', label: 'Breads' }]
  }
];

const availableLists: VisibleList[] = [
  {
    _id: 'list-home-reset',
    publicId: 'home-reset',
    slug: 'home-reset',
    name: 'Home reset',
    visibility: 'personal',
    createdByUserId: 'user'
  },
  {
    _id: 'list-weekly-shop',
    publicId: 'weekly-shop',
    slug: 'weekly-shop',
    name: 'Weekly shop',
    visibility: 'shared',
    createdByUserId: 'user'
  }
];

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(async () => {
  await Promise.all(mounted.splice(0).map((component) => unmount(component)));
  document.body.innerHTML = '';
});

function renderPanel(
  overrides: {
    onReorder?: (propertyId: string, targetIndex: number) => Promise<boolean>;
    currentDefaultPublicId?: string | null;
    onSetDefaultList?: (publicId: string) => void;
    onSetCategorisation?: (input: { propertyId: string; instruction: string }) => void;
    onClearCategorisation?: (propertyId: string) => void;
    error?: string | null;
  } = {}
) {
  const target = document.body.appendChild(document.createElement('div'));
  const component = mount(ListSettingsPanel, {
    target,
    props: {
      properties,
      error: overrides.error ?? null,
      onClose: vi.fn(),
      onReorder: overrides.onReorder ?? vi.fn(async () => true),
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
      propertyTypeLabel: (type: VisibleListProperty['type']) => type,
      onDeleteList: vi.fn(),
      availableLists,
      currentDefaultPublicId: overrides.currentDefaultPublicId ?? null,
      onSetDefaultList: overrides.onSetDefaultList ?? vi.fn(),
      onSetCategorisation: overrides.onSetCategorisation ?? vi.fn(),
      onClearCategorisation: overrides.onClearCategorisation ?? vi.fn()
    }
  });
  mounted.push(component);
  return target;
}

function propertyNames(target: HTMLElement) {
  return [...target.querySelectorAll('li')].map((row) => row.querySelector('p')?.textContent?.trim());
}

function picker(target: HTMLElement) {
  return target.querySelector<HTMLSelectElement>('[data-testid="default-list-picker"]');
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

  it('saves AI categorisation only for a select property with a human instruction', async () => {
    const onSetCategorisation = vi.fn();
    const target = renderPanel({ onSetCategorisation });
    const property = target.querySelector<HTMLSelectElement>('[aria-label="AI categorisation property"]');
    const instruction = target.querySelector<HTMLInputElement>('[aria-label="AI categorisation instruction"]');
    const form = instruction?.closest('form');

    expect(property).not.toBeNull();
    expect(instruction).not.toBeNull();
    expect(form).not.toBeNull();

    await tick();
    expect(property!.value).toBe('priority');
    instruction!.value = 'Place groceries into the correct section.';
    instruction!.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    form!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    expect(onSetCategorisation).toHaveBeenCalledWith({
      propertyId: 'priority',
      instruction: 'Place groceries into the correct section.'
    });
  });

  it('turns off the configured property after choosing a different property', async () => {
    const onClearCategorisation = vi.fn();
    const target = renderPanel({ onClearCategorisation });
    const property = target.querySelector<HTMLSelectElement>('[aria-label="AI categorisation property"]');

    await tick();
    property!.value = 'aisle';
    property!.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    [...target.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === 'Turn off AI categorisation')
      ?.click();

    expect(onClearCategorisation).toHaveBeenCalledWith('priority');
  });

  it('rolls an optimistic order back when persistence fails', async () => {
    const onReorder = vi.fn(async () => false);
    const target = renderPanel({ onReorder });
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

describe('ListSettingsPanel default-list picker', () => {
  it('renders the personal and shared lists as options', async () => {
    const target = renderPanel();
    await tick();

    const select = picker(target);
    expect(select).not.toBeNull();

    const groups = [...select!.querySelectorAll('optgroup')].map((group) => group.label);
    expect(groups).toEqual(['Personal lists', 'Shared lists']);

    const optionValues = [...select!.querySelectorAll('option')].map((option) => option.value);
    expect(optionValues).toEqual(['', 'home-reset', 'weekly-shop']);
  });

  it('marks the current default as the selected option', async () => {
    const target = renderPanel({ currentDefaultPublicId: 'weekly-shop' });
    await tick();

    expect(picker(target)?.value).toBe('weekly-shop');
  });

  it('shows no default selected when none is set', async () => {
    const target = renderPanel({ currentDefaultPublicId: null });
    await tick();

    expect(picker(target)?.value).toBe('');
  });

  it('passes the chosen list publicId when the user selects another option', async () => {
    const onSetDefaultList = vi.fn();
    const target = renderPanel({ currentDefaultPublicId: 'home-reset', onSetDefaultList });
    await tick();

    const select = picker(target)!;
    select.value = 'weekly-shop';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onSetDefaultList).toHaveBeenCalledWith('weekly-shop');
  });

  it('surfaces a default-list mutation error in the settings panel', async () => {
    const target = renderPanel({ error: 'Unable to set default list.' });
    await tick();

    expect(target.textContent).toContain('Unable to set default list.');
  });

  it('does not invoke the callback for the placeholder option', async () => {
    const onSetDefaultList = vi.fn();
    const target = renderPanel({ currentDefaultPublicId: 'home-reset', onSetDefaultList });
    await tick();

    const select = picker(target)!;
    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onSetDefaultList).not.toHaveBeenCalled();
  });
});

import ListSettingsPanel from '$lib/lists/components/ListSettingsPanel.svelte';
