import { mount, tick, unmount } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom doesn't implement Web Animations API – stub with instant completion
if (!Element.prototype.animate) {
  Element.prototype.animate = function () {
    const anim = {
      finished: Promise.resolve(this),
      cancel() {},
      finish() {},
      onfinish: null as ((this: Animation, ev: AnimationPlaybackEvent) => void) | null,
      currentTime: null,
      playState: 'finished'
    };
    // Fire onfinish synchronously so Svelte outro transitions clean up immediately
    queueMicrotask(() => {
      if (typeof anim.onfinish === 'function')
        anim.onfinish.call(anim as unknown as Animation, new Event('finish') as AnimationPlaybackEvent);
    });
    return anim as unknown as Animation;
  };
}

import type { VisibleList, VisibleListItemsResult } from '$lib/lists/presenter';
import { previewItemsByListPublicId, previewVisibleLists } from '$lib/lists/presenter';

type QueryValue = VisibleList[] | VisibleListItemsResult | string | null | undefined;

type QueryResult = {
  readonly data: QueryValue;
  readonly error: Error | undefined;
  readonly isLoading: boolean;
  set(next: { data?: QueryValue; error?: Error; isLoading?: boolean }): void;
};

const queryResults: QueryResult[] = [];
const { autoCategoriseAction, mutationFunctions } = vi.hoisted(() => ({
  autoCategoriseAction: vi.fn(),
  mutationFunctions: [] as Array<ReturnType<typeof vi.fn>>
}));

vi.mock('convex-svelte', () => ({
  useMutation: () => {
    const mutation = vi.fn(async () => undefined);
    mutationFunctions.push(mutation);
    return mutation;
  },
  useAction: () => autoCategoriseAction,
  useQuery: () => {
    let data: QueryValue;
    let error: Error | undefined;
    let isLoading = true;
    let update = () => {};
    const subscribe = createSubscriber((nextUpdate) => {
      update = nextUpdate;
    });
    const result: QueryResult = {
      get data() {
        subscribe();
        return data;
      },
      get error() {
        subscribe();
        return error;
      },
      get isLoading() {
        subscribe();
        return isLoading;
      },
      set(next) {
        if ('data' in next) data = next.data;
        if ('error' in next) error = next.error;
        if ('isLoading' in next) isLoading = next.isLoading ?? isLoading;
        update();
      }
    };
    queryResults.push(result);
    return result;
  }
}));

vi.mock('$app/navigation', () => ({ goto: vi.fn(async () => undefined) }));
vi.mock('$app/paths', () => ({ base: '' }));
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/lists/weekly-shop') } }));
vi.mock('svelte-dnd-action', () => ({
  dragHandle: vi.fn(),
  dragHandleZone: vi.fn()
}));

import ListsScreen from '$lib/lists/components/ListsScreen.svelte';

let mounted: ReturnType<typeof mount> | null = null;

beforeEach(() => {
  queryResults.length = 0;
  mutationFunctions.length = 0;
  autoCategoriseAction.mockReset();
  autoCategoriseAction.mockResolvedValue({ status: 'applied', assignmentCount: 2 });
});

afterEach(async () => {
  vi.useRealTimers();
  if (mounted) await unmount(mounted);
  mounted = null;
  document.body.innerHTML = '';
});

async function renderScreen(selectedPublicId: string | null = 'weekly-shop') {
  const target = document.body.appendChild(document.createElement('div'));
  mounted = mount(ListsScreen, { target, props: { selectedPublicId } });
  await tick();
  return target;
}

async function provideLiveData(publicId = 'weekly-shop') {
  queryResults[0]?.set({ data: previewVisibleLists, isLoading: false });
  queryResults[1]?.set({ data: previewItemsByListPublicId[publicId], isLoading: false });
  queryResults[3]?.set({ data: null, isLoading: false });
  await tick();
}

describe('ListsScreen mobile details', () => {
  it('dismisses item details completely and can reopen them', async () => {
    const target = await renderScreen();
    await provideLiveData();

    target.querySelectorAll<HTMLElement>('[role="button"]').forEach((el) => {
      if (el.textContent?.includes('Bananas')) el.click();
    });
    await tick();
    expect(target.querySelector('textarea')?.value).toBe('Buy firm ones so they last the week.');

    target.querySelector<HTMLButtonElement>('button[aria-label="Close details"]')?.click();
    await tick();
    await tick();
    expect(target.querySelector('textarea')).toBeNull();

    target.querySelectorAll<HTMLElement>('[role="button"]').forEach((el) => {
      if (el.textContent?.includes('Bananas')) el.click();
    });
    await tick();
    expect(target.querySelector('textarea')?.value).toBe('Buy firm ones so they last the week.');
  });
});

describe('ListsScreen list actions', () => {
  it('uses a full-card hit target for list navigation', async () => {
    const target = await renderScreen('home-reset');
    await provideLiveData('home-reset');

    const listButton = target.querySelector<HTMLButtonElement>('button[aria-label="Open Home reset list"]');

    expect(listButton).not.toBeNull();
    expect(listButton?.className).toContain('w-full');
    expect(listButton?.className).toContain('p-[14px]');
  });

  it('opens rename from the list actions menu', async () => {
    const target = await renderScreen('home-reset');
    await provideLiveData('home-reset');

    target.querySelector<HTMLButtonElement>('button[aria-label="List actions for Home reset"]')?.click();
    await tick();

    const renameButton = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Rename'
    );

    expect(renameButton).toBeDefined();

    renameButton?.click();
    await tick();

    expect(target.querySelector('#list-dialog-title')?.textContent).toBe('Rename list');
  });

  it('raises the open menu above nearby list cards and closes from the click-away layer', async () => {
    const target = await renderScreen('home-reset');
    await provideLiveData('home-reset');

    target.querySelector<HTMLButtonElement>('button[aria-label="List actions for Home reset"]')?.click();
    await tick();

    const openMenuHost = target.querySelector('[data-list-menu-open="true"]');

    expect(openMenuHost).not.toBeNull();
    expect(openMenuHost?.className).toContain('z-30');
    expect(target.querySelector('button[aria-label="Close list actions menu"]')).not.toBeNull();
    expect(
      target.querySelector('button[aria-label="Close list actions menu"]')?.closest('.-translate-y-1\\/2')
    ).toBeNull();

    target.querySelector<HTMLButtonElement>('button[aria-label="Close list actions menu"]')?.click();
    await tick();

    expect(target.querySelector('button[aria-label="Close list actions menu"]')).toBeNull();
    expect(target.querySelector('[data-list-menu-open="true"]')).toBeNull();
  });
});

describe('ListsScreen item header', () => {
  it('places the active item count with the Items label', async () => {
    const target = await renderScreen();
    await provideLiveData();

    const count = target.querySelector('[aria-label="3 active items"]');

    expect(count).not.toBeNull();
    expect(count?.previousElementSibling?.textContent).toBe('Items');
  });

  it('moves a completed item immediately while the live query catches up', async () => {
    const target = await renderScreen();
    await provideLiveData();

    target.querySelector<HTMLButtonElement>('button[aria-label="Mark Milk complete"]')?.click();
    await tick();

    expect(target.querySelector('[aria-label="2 active items"]')).not.toBeNull();
    expect(target.querySelector('button[aria-label="Mark Milk complete"]')).toBeNull();
    expect(target.querySelector('button[aria-label="Mark Milk active"]')).not.toBeNull();
  });

  it('reopens a completed item immediately while the live query catches up', async () => {
    const target = await renderScreen();
    await provideLiveData();

    target.querySelector<HTMLButtonElement>('button[aria-label="Mark Apples active"]')?.click();
    await tick();

    expect(target.querySelector('[aria-label="4 active items"]')).not.toBeNull();
    expect(target.querySelector('button[aria-label="Mark Apples active"]')).toBeNull();
    expect(target.querySelector('button[aria-label="Mark Apples complete"]')).not.toBeNull();
  });
});

describe('ListsScreen property settings', () => {
  it('opens Select options in the property editor', async () => {
    const target = await renderScreen();
    await provideLiveData();

    target.querySelector<HTMLButtonElement>('button[aria-label="List settings"]')?.click();
    await tick();
    target.querySelector<HTMLButtonElement>('button[aria-label="Rename Priority"]')?.click();
    await tick();

    expect(target.querySelector<HTMLInputElement>('[aria-label="Option High"]')?.value).toBe('High');
    expect(target.querySelector<HTMLInputElement>('[aria-label="Option Low"]')?.value).toBe('Low');
  });
});

describe('ListsScreen mobile switcher', () => {
  it('opens on the selected shared list tab', async () => {
    const target = await renderScreen();
    await provideLiveData();

    const switcherButton = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Weekly shop') && button.querySelector('[title="Shared list"]')
    );
    switcherButton?.click();
    await tick();

    expect(target.textContent).toContain('Birthday dinner');
  });

  it('marks shared lists with an icon in the selector and switcher list', async () => {
    const target = await renderScreen();
    await provideLiveData();

    const switcherButton = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Weekly shop') && button.querySelector('[title="Shared list"]')
    );
    expect(switcherButton?.querySelector('[title="Shared list"]')).not.toBeNull();

    switcherButton?.click();
    await tick();

    const sharedTab = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Shared'
    );
    sharedTab?.click();
    await tick();

    expect(target.querySelector('[title="Shared list"]')).not.toBeNull();
  });
});

describe('ListsScreen active-item grouping', () => {
  it('queues rapid grouping changes so the last selection is saved last', async () => {
    const target = await renderScreen();
    await provideLiveData();
    const groupingMutation = mutationFunctions[1];
    if (!groupingMutation) throw new Error('Expected active grouping mutation');

    let resolveFirstSave: (() => void) | undefined;
    groupingMutation.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstSave = resolve;
        })
    );

    const grouping = target.querySelector<HTMLSelectElement>('select[aria-label="Group active items by"]');
    if (!grouping) throw new Error('Expected grouping control');
    grouping.value = 'preview-property-priority';
    grouping.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();

    grouping.value = 'preview-property-aisle';
    grouping.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();

    expect(groupingMutation).toHaveBeenCalledTimes(1);
    expect(groupingMutation).toHaveBeenLastCalledWith({
      listPublicId: 'weekly-shop',
      propertyId: 'preview-property-priority'
    });

    resolveFirstSave?.();
    await new Promise((resolve) => setTimeout(resolve));
    await tick();

    expect(groupingMutation).toHaveBeenCalledTimes(2);
    expect(groupingMutation).toHaveBeenLastCalledWith({
      listPublicId: 'weekly-shop',
      propertyId: 'preview-property-aisle'
    });
  });

  it('restores the current user’s saved grouping when the list loads', async () => {
    const target = await renderScreen();
    queryResults[0]?.set({ data: previewVisibleLists, isLoading: false });
    queryResults[1]?.set({ data: previewItemsByListPublicId['weekly-shop'], isLoading: false });
    queryResults[3]?.set({ data: 'preview-property-aisle', isLoading: false });
    await tick();

    expect(
      target.querySelector<HTMLSelectElement>('select[aria-label="Group active items by"]')?.selectedOptions[0]
        ?.textContent
    ).toBe('Aisle');
  });

  it('shows a stable loading state until auto categorisation completes', async () => {
    let resolveCategorisation: ((value: { status: 'applied'; assignmentCount: number }) => void) | undefined;
    autoCategoriseAction.mockImplementationOnce(
      () =>
        new Promise<{ status: 'applied'; assignmentCount: number }>((resolve) => {
          resolveCategorisation = resolve;
        })
    );
    const target = await renderScreen();
    const weeklyShop = previewItemsByListPublicId['weekly-shop'];
    queryResults[0]?.set({ data: previewVisibleLists, isLoading: false });
    queryResults[1]?.set({
      data: {
        ...weeklyShop,
        properties: weeklyShop.properties.map((property) =>
          property._id === 'preview-property-priority'
            ? { ...property, categorisationInstruction: 'Group items by priority.' }
            : property
        )
      },
      isLoading: false
    });
    await tick();

    target.querySelector<HTMLButtonElement>('[data-testid="auto-categorise-action"]')?.click();
    await tick();

    expect(target.querySelector('[role="status"]')?.textContent).toContain('Categorising items');
    expect(
      target.querySelector<HTMLSelectElement>('select[aria-label="Group active items by"]')?.selectedOptions[0]
        ?.textContent
    ).toBe('Manual order');

    resolveCategorisation?.({ status: 'applied', assignmentCount: 2 });
    await new Promise((resolve) => setTimeout(resolve));
    await tick();

    expect(target.querySelector('[role="status"]')).toBeNull();
    expect(
      target.querySelector<HTMLSelectElement>('select[aria-label="Group active items by"]')?.selectedOptions[0]
        ?.textContent
    ).toBe('Priority');
  });

  it('groups by the configured categorisation property after auto categorisation starts', async () => {
    const target = await renderScreen();
    const weeklyShop = previewItemsByListPublicId['weekly-shop'];
    queryResults[0]?.set({ data: previewVisibleLists, isLoading: false });
    queryResults[1]?.set({
      data: {
        ...weeklyShop,
        properties: weeklyShop.properties.map((property) =>
          property._id === 'preview-property-priority'
            ? { ...property, categorisationInstruction: 'Group items by priority.' }
            : property
        )
      },
      isLoading: false
    });
    await tick();

    const autoCategorise = target.querySelector<HTMLButtonElement>('[data-testid="auto-categorise-action"]');
    expect(autoCategorise?.disabled).toBe(false);
    autoCategorise?.click();
    await new Promise((resolve) => setTimeout(resolve));
    await tick();

    const grouping = target.querySelector<HTMLSelectElement>('select[aria-label="Group active items by"]');
    expect(grouping?.selectedOptions[0]?.textContent).toBe('Priority');
  });

  it('groups active items by a property and collapses a group without affecting its items', async () => {
    const target = await renderScreen();
    await provideLiveData();

    const grouping = target.querySelector<HTMLSelectElement>('select[aria-label="Group active items by"]');
    expect(grouping).not.toBeNull();
    if (!grouping) throw new Error('Expected grouping control');

    grouping.value = 'preview-property-aisle';
    grouping.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const dairyGroup = target.querySelector<HTMLButtonElement>('button[aria-label="Collapse Dairy group"]');
    expect(dairyGroup?.textContent).toContain('Dairy');
    expect(target.querySelector('button[aria-label="Mark Milk complete"]')).not.toBeNull();
    expect(target.querySelector('[aria-label="Drag to reorder Milk"]')).toBeNull();
    expect(target.querySelector('button[aria-label="Collapse Unassigned group"]')).not.toBeNull();

    dairyGroup?.click();
    await tick();

    expect(target.querySelector('button[aria-label="Expand Dairy group"]')).not.toBeNull();
    expect(target.querySelector('button[aria-label="Mark Milk complete"]')).toBeNull();
    expect(target.querySelector('button[aria-label="Mark Apples active"]')).not.toBeNull();

    grouping.value = '';
    grouping.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(target.querySelector('button[aria-label="Collapse Dairy group"]')).toBeNull();
    expect(target.querySelector('[aria-label="Drag to reorder Milk"]')).not.toBeNull();
  });

  it('returns to Manual order when the selected list does not define the active grouping property', async () => {
    const target = await renderScreen();
    await provideLiveData();

    const grouping = target.querySelector<HTMLSelectElement>('select[aria-label="Group active items by"]');
    if (!grouping) throw new Error('Expected grouping control');
    grouping.value = 'preview-property-aisle';
    grouping.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    await provideLiveData('home-reset');

    const updatedGrouping = target.querySelector<HTMLSelectElement>('select[aria-label="Group active items by"]');
    expect(updatedGrouping?.selectedOptions[0]?.textContent).toBe('Manual order');
    expect(target.querySelector('[aria-label="Drag to reorder Fold laundry"]')).not.toBeNull();
  });
});

describe('ListsScreen offline fallback', () => {
  it('leaves fallback mode as soon as a live query responds', async () => {
    vi.useFakeTimers();
    const target = await renderScreen();

    await vi.advanceTimersByTimeAsync(4_000);
    await tick();
    expect(target.querySelector('[role="status"]')?.textContent).toContain('Offline demo data');

    queryResults[0]?.set({ data: previewVisibleLists, isLoading: false });
    await tick();

    const statusMessages = Array.from(target.querySelectorAll('[role="status"]')).map(
      (status) => status.textContent ?? ''
    );
    expect(statusMessages.some((message) => message.includes('Offline demo data'))).toBe(false);
  });
});

describe('ListsScreen loading state', () => {
  it('shows skeleton loading feedback without the startup copy card', async () => {
    const target = await renderScreen();

    const loadingStatus = target.querySelector('[role="status"]');

    expect(loadingStatus).not.toBeNull();
    expect(loadingStatus?.textContent).toContain('Loading lists');
    expect(target.textContent).not.toContain('Getting your lists ready');
    expect(target.querySelector('.startup-skeleton-grid')).not.toBeNull();
  });
});

describe('ListsScreen empty state', () => {
  it('opens the create-list dialog when no list is selected', async () => {
    const target = await renderScreen(null);
    queryResults[0]?.set({ data: [], isLoading: false });
    await tick();

    const createButton = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Create list'
    );
    expect(createButton).toBeDefined();

    createButton?.click();
    await tick();

    expect(target.querySelector('#list-dialog-title')?.textContent).toBe('New list');
    const nameInput = target.querySelector<HTMLInputElement>('input[placeholder="New list name"]');
    expect(nameInput).not.toBeNull();
    expect(document.activeElement).toBe(nameInput);
  });
});
