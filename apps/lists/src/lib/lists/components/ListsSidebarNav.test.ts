import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ListsSidebarNav from '$lib/lists/components/ListsSidebarNav.svelte';
import type { PresentedList } from '$lib/lists/presenter';

function list(publicId: string): PresentedList {
  return {
    _id: `row-${publicId}`,
    publicId,
    slug: publicId,
    name: publicId,
    visibility: 'shared',
    createdByUserId: 'user-a',
    description: 'Shared list',
    selected: false
  };
}

let component: ReturnType<typeof mount> | null = null;

afterEach(() => {
  if (component) unmount(component);
  component = null;
  document.body.innerHTML = '';
});

function render(onReorder: (input: { publicId: string; targetIndex: number }) => Promise<void>) {
  const lists = [list('groceries'), list('chores'), list('hardware')];
  component = mount(ListsSidebarNav, {
    target: document.body,
    props: {
      lists,
      emptyLabel: 'No shared lists yet.',
      menuTargetPublicId: null,
      onOpen: () => {},
      onRename: () => {},
      onDelete: () => {},
      onReorder
    }
  });
  flushSync();
  return lists;
}

function shownOrder() {
  return [...document.querySelectorAll('button[aria-label^="Open "]')].map((button) =>
    button.getAttribute('aria-label')?.replace(/^Open (.*) list$/, '$1')
  );
}

/** What svelte-dnd-action dispatches when a drag ends. */
function drop(lists: PresentedList[], order: string[], movedId: string) {
  const zone = document.querySelector('ul[aria-label="Lists"]')!;
  const items = order.map((id) => ({ id, list: lists.find((entry) => entry.publicId === id)! }));
  zone.dispatchEvent(new CustomEvent('finalize', { detail: { items, info: { id: movedId } } }));
  flushSync();
}

describe('ListsSidebarNav', () => {
  it('saves a dropped list at its new position and keeps it there while saving', async () => {
    let finishSave = () => {};
    const onReorder = vi.fn(() => new Promise<void>((resolve) => (finishSave = resolve)));
    const lists = render(onReorder);

    drop(lists, ['hardware', 'groceries', 'chores'], 'hardware');

    expect(onReorder).toHaveBeenCalledWith({ publicId: 'hardware', targetIndex: 0 });
    expect(shownOrder()).toEqual(['hardware', 'groceries', 'chores']);
    finishSave();
    await tick();
  });

  it('saves nothing when a list is dropped where it started', () => {
    const onReorder = vi.fn(async () => {});
    const lists = render(onReorder);

    drop(lists, ['groceries', 'chores', 'hardware'], 'chores');

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('puts the saved order back and says so when the save fails', async () => {
    const onReorder = vi.fn(async () => {
      throw new Error('offline');
    });
    const lists = render(onReorder);

    drop(lists, ['hardware', 'groceries', 'chores'], 'hardware');
    await vi.waitFor(() => expect(document.body.textContent).toContain('Unable to save the new list order.'));
    await tick();

    expect(shownOrder()).toEqual(['groceries', 'chores', 'hardware']);
  });
});
