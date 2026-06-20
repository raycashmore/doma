import { mount, tick, unmount } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VisibleList, VisibleListItemsResult } from '$lib/lists-presenter';
import { previewItemsByListPublicId, previewVisibleLists } from '$lib/lists-presenter';

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

import ListsScreen from '$lib/ListsScreen.svelte';

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

async function renderScreen() {
  const target = document.body.appendChild(document.createElement('div'));
  mounted = mount(ListsScreen, { target, props: { selectedPublicId: 'weekly-shop' } });
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

    [...target.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Bananas')?.click();
    await tick();
    expect(target.querySelector('textarea')?.value).toBe('Buy firm ones so they last the week.');

    target.querySelector<HTMLButtonElement>('button[aria-label="Close details"]')?.click();
    await tick();
    expect(target.querySelector('textarea')).toBeNull();

    [...target.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Bananas')?.click();
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

    expect(target.querySelector('[role="status"]')).toBeNull();
  });
});
