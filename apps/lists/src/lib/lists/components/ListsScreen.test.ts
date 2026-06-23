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

type QueryValue = VisibleList[] | VisibleListItemsResult | null | undefined;

type QueryResult = {
  readonly data: QueryValue;
  readonly error: Error | undefined;
  readonly isLoading: boolean;
  set(next: { data?: QueryValue; error?: Error; isLoading?: boolean }): void;
};

const queryResults: QueryResult[] = [];

vi.mock('convex-svelte', () => ({
  useMutation: () => vi.fn(async () => undefined),
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

async function provideLiveData() {
  queryResults[0]?.set({ data: previewVisibleLists, isLoading: false });
  queryResults[1]?.set({ data: previewItemsByListPublicId['weekly-shop'], isLoading: false });
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
  it('shows visible startup feedback while live lists are loading', async () => {
    const target = await renderScreen();

    const loadingStatus = target.querySelector('[role="status"]');

    expect(loadingStatus).not.toBeNull();
    expect(loadingStatus?.textContent).toContain('Loading lists');
    expect(loadingStatus?.getAttribute('aria-hidden')).toBeNull();
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
  });
});
