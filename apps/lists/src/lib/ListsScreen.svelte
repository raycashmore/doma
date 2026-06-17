<script lang="ts">
  import { api } from '@repo/convex';
  import { slugifyListName } from '@repo/convex/lists/model';
  import { useMutation, useQuery } from 'convex-svelte';

  import { browser, dev } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import {
    fixtureCategories,
    type FixtureListItem,
    selectedItemDetail  } from '$lib/lists-fixtures';
  import {
    type PresentedList,
    presentLists,
    presentListScreen,
    previewVisibleLists  } from '$lib/lists-presenter';
  import {
    buildListHref,
    buildListsHomeHref,
    readLastListPublicId,
    writeLastListPublicId
  } from '$lib/lists-routing';

  const USE_DEV_FIXTURE = dev && !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  let {
    selectedPublicId = null
  }: {
    selectedPublicId?: string | null;
  } = $props();

  const visibleLists = useQuery(api.lists.queries.listVisibleToMe, () =>
    USE_DEV_FIXTURE ? 'skip' : {}
  );
  const selectedList = useQuery(api.lists.queries.getVisibleListByPublicId, () =>
    USE_DEV_FIXTURE || !selectedPublicId ? 'skip' : { publicId: selectedPublicId }
  );
  const createList = useMutation(api.lists.mutations.createList);
  const renameList = useMutation(api.lists.mutations.renameList);
  const deleteList = useMutation(api.lists.mutations.deleteList);

  let createName = $state('');
  let createVisibility = $state<'personal' | 'shared'>('personal');
  let renameName = $state('');
  let renameSeededFor = $state<string | null>(null);
  let mutationError = $state<string | null>(null);
  let uiMode = $state<'mobile' | 'desktop'>('mobile');
  let listFilter = $state<'personal' | 'shared'>('personal');
  let activeItemId = $state('item-avocados');
  let showListPicker = $state(false);
  let showItemSheet = $state(false);
  let showCreateDialog = $state(false);
  let menuTargetPublicId = $state<string | null>(null);
  let renameTargetPublicId = $state<string | null>(null);
  let deleteTargetPublicId = $state<string | null>(null);
  let usePreviewData = $state(USE_DEV_FIXTURE);
  let previewLists = $state([...previewVisibleLists]);

  function updateUiMode() {
    if (!browser) return;
    uiMode = window.innerWidth >= 1200 ? 'desktop' : 'mobile';
  }

  function describeError(error: unknown, fallback: string) {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : null;

    if (!message) return fallback;
    if (message.includes('Not authenticated')) {
      return 'Sign in to load and edit household lists.';
    }
    if (message.includes('List unavailable')) {
      return 'This list may have been deleted or is no longer visible to you.';
    }

    return message;
  }

  function isSelectedListUnavailable() {
    if (!selectedPublicId || selectedList.isLoading) return false;
    if (selectedList.error) return true;
    if (visibleLists.isLoading) return false;
    return selectedList.data === null;
  }

  function listIcon(icon: PresentedList['icon']) {
    if (icon === 'house') return 'H';
    if (icon === 'party-popper') return 'P';
    return 'S';
  }

  function selectedItem() {
    for (const category of fixtureCategories) {
      const match = category.items.find((item) => item.id === activeItemId);
      if (match) return match;
    }

    return fixtureCategories[0]?.items[0] ?? null;
  }

  function openItem(item: FixtureListItem) {
    activeItemId = item.id;
    if (uiMode === 'mobile') {
      showItemSheet = true;
    }
  }

  function closeMenus() {
    menuTargetPublicId = null;
  }

  async function navigateToList(list: { publicId: string; slug: string }) {
    closeMenus();
    showListPicker = false;
    await goto(buildListHref(base, list), { noScroll: true, keepFocus: true });
  }

  async function handleCreateList() {
    mutationError = null;

    if (usePreviewData) {
      const name = createName.trim() || 'Untitled list';
      const slug = slugifyListName(name);
      const created = {
        _id: `preview-${crypto.randomUUID()}`,
        publicId: slug,
        slug,
        name,
        visibility: createVisibility,
        createdByUserId: 'preview-user'
      };

      previewLists = [created, ...previewLists];
      createName = '';
      showCreateDialog = false;
      showListPicker = false;
      await goto(buildListHref(base, created), { noScroll: true, keepFocus: true });
      return;
    }

    try {
      const created = await createList({
        name: createName,
        visibility: createVisibility
      });

      createName = '';
      showCreateDialog = false;
      showListPicker = false;
      await goto(buildListHref(base, created), { noScroll: true, keepFocus: true });
    } catch (error) {
      mutationError = error instanceof Error ? error.message : 'Unable to create list.';
    }
  }

  async function handleRenameList() {
    if (!renameTargetPublicId) return;
    mutationError = null;

    if (usePreviewData) {
      const name = renameName.trim() || 'Untitled list';
      previewLists = previewLists.map((list) =>
        list.publicId === renameTargetPublicId
          ? { ...list, name, slug: slugifyListName(name) }
          : list
      );

      const renamed = previewLists.find((list) => list.publicId === renameTargetPublicId);
      renameTargetPublicId = null;
      menuTargetPublicId = null;
      if (renamed) {
        await goto(buildListHref(base, renamed), {
          replaceState: true,
          noScroll: true,
          keepFocus: true
        });
      }
      return;
    }

    try {
      const renamed = await renameList({
        publicId: renameTargetPublicId,
        name: renameName
      });

      renameTargetPublicId = null;
      menuTargetPublicId = null;
      await goto(buildListHref(base, renamed), {
        replaceState: true,
        noScroll: true,
        keepFocus: true
      });
    } catch (error) {
      mutationError = error instanceof Error ? error.message : 'Unable to rename list.';
    }
  }

  async function handleDeleteList() {
    if (!deleteTargetPublicId) return;
    mutationError = null;

    const remaining =
      presentedLists.filter((list) => list.publicId !== deleteTargetPublicId) ?? [];

    async function navigateAfterDelete() {
      const nextList = remaining[0];
      if (nextList) {
        await goto(buildListHref(base, nextList), {
          replaceState: true,
          noScroll: true,
          keepFocus: true
        });
        return;
      }

      await goto(buildListsHomeHref(base), {
        replaceState: true,
        noScroll: true,
        keepFocus: true
      });
    }

    if (usePreviewData) {
      previewLists = previewLists.filter((list) => list.publicId !== deleteTargetPublicId);
      deleteTargetPublicId = null;
      menuTargetPublicId = null;
      await navigateAfterDelete();
      return;
    }

    try {
      await deleteList({ publicId: deleteTargetPublicId });

      deleteTargetPublicId = null;
      menuTargetPublicId = null;
      await navigateAfterDelete();
    } catch (error) {
      mutationError = error instanceof Error ? error.message : 'Unable to delete list.';
    }
  }

  function beginRename(list: PresentedList) {
    renameTargetPublicId = list.publicId;
    deleteTargetPublicId = null;
    renameSeededFor = list.publicId;
    renameName = list.name;
  }

  function beginDelete(list: PresentedList) {
    deleteTargetPublicId = list.publicId;
    renameTargetPublicId = null;
    renameSeededFor = null;
  }

  $effect(() => {
    if (!browser) return;
    updateUiMode();
    window.addEventListener('resize', updateUiMode);

    return () => {
      window.removeEventListener('resize', updateUiMode);
    };
  });

  $effect(() => {
    if (!browser) return;
    const row = selectedRow;
    if (!row?.publicId) return;
    writeLastListPublicId(row.publicId);
  });

  $effect(() => {
    if (!browser || selectedPublicId) return;
    const rows = visibleListRows;
    if (!rows?.length) return;

    const lastPublicId = readLastListPublicId();
    const preferred = rows.find((row) => row.publicId === lastPublicId) ?? rows[0];
    if (!preferred) return;

    void goto(buildListHref(base, preferred), {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  });

  $effect(() => {
    if (!renameTargetPublicId || renameSeededFor === renameTargetPublicId) return;
    const row = visibleListRows.find((list) => list.publicId === renameTargetPublicId);
    if (!row) return;

    renameName = row.name;
    renameSeededFor = renameTargetPublicId;
  });

  $effect(() => {
    if (!browser) return;
    const row = selectedRow;
    if (!row || !selectedPublicId) return;
    if (row.publicId !== selectedPublicId) return;

    const canonicalHref = buildListHref(base, row);
    if (page.url.pathname === canonicalHref) return;

    void goto(canonicalHref, {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  });

  const visibleListRows = $derived(usePreviewData ? previewLists : (visibleLists.data ?? []));
  const selectedRow = $derived(
    usePreviewData
      ? visibleListRows.find((list) => list.publicId === selectedPublicId) ?? visibleListRows[0] ?? null
      : selectedList.data ?? null
  );
  const presentedLists = $derived(
    presentLists(visibleListRows, selectedRow?.publicId ?? selectedPublicId)
  );
  const selectedPresentedList = $derived(
    presentedLists.find((list) => list.selected) ??
      (selectedRow
        ? presentLists([selectedRow], selectedRow.publicId)[0]
        : null)
  );
  const screen = $derived(presentListScreen(selectedPresentedList ?? null));
  const filteredLists = $derived(
    presentedLists.filter((list) => list.visibility === listFilter)
  );
  const currentItem = $derived(selectedItem());

  $effect(() => {
    if (!browser || !dev || usePreviewData) return;
    if (visibleLists.data || visibleLists.error || selectedList.data || selectedList.error) return;

    const timeoutId = window.setTimeout(() => {
      usePreviewData = true;
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  });
</script>

{#if selectedPublicId && !usePreviewData && isSelectedListUnavailable()}
  <section class="rounded-[32px] border border-warm-border bg-warm-bg-card p-8 text-sm text-warm-text-secondary">
    This list is unavailable.
  </section>
{:else if !usePreviewData && (visibleLists.isLoading || (selectedPublicId && selectedList.isLoading))}
  <section aria-hidden="true" class="sr-only">Loading Lists...</section>
{:else if !usePreviewData && visibleLists.error}
  <section class="rounded-[32px] border border-warm-border bg-warm-bg-card p-8 text-sm text-warm-text-secondary">
    {describeError(visibleLists.error, 'Unable to load lists right now.')}
  </section>
{:else}
  <section class="flex min-h-full flex-col text-warm-text-primary">
      <div class="flex min-h-full flex-1 flex-col rounded-[18px] bg-warm-bg-card p-[14px] shadow-[0_18px_44px_rgb(20_17_12_/_10%)] md:rounded-[28px] md:p-6 min-[1200px]:flex-row min-[1200px]:gap-5">
            <aside class="hidden w-[244px] shrink-0 flex-col gap-4 rounded-[20px] border border-warm-border bg-warm-bg p-[18px] min-[1200px]:flex">
              <div class="flex items-center justify-between">
                <h2 class="text-base font-semibold text-warm-text-primary">My Lists</h2>
                <button
                  type="button"
                  class="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-warm-bg-dark text-sm font-semibold text-warm-text-on-dark"
                  onclick={() => {
                    showCreateDialog = true;
                    createVisibility = listFilter;
                  }}
                >
                  +
                </button>
              </div>

              <div class="flex rounded-full bg-warm-section-mortgage p-1">
                <button
                  type="button"
                  class={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${
                    listFilter === 'personal'
                      ? 'bg-warm-text-primary text-warm-text-on-dark'
                      : 'text-warm-text-secondary'
                  }`}
                  onclick={() => (listFilter = 'personal')}
                >
                  Personal
                </button>
                <button
                  type="button"
                  class={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${
                    listFilter === 'shared'
                      ? 'bg-warm-text-primary text-warm-text-on-dark'
                      : 'text-warm-text-secondary'
                  }`}
                  onclick={() => (listFilter = 'shared')}
                >
                  Shared
                </button>
              </div>

              <div class="flex flex-col gap-[10px]">
                {#if filteredLists.length}
                  {#each filteredLists as list (list.publicId)}
                    <div
                      class={`rounded-2xl border p-[14px] ${
                        list.selected
                          ? 'border-warm-accent bg-warm-section-spend'
                          : 'border-warm-border bg-warm-bg-card'
                      }`}
                    >
                      <div class="flex items-start gap-3">
                        <div class={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
                          list.selected ? 'bg-warm-bg text-warm-text-primary' : 'bg-warm-section-mortgage text-warm-text-secondary'
                        }`}>
                          {listIcon(list.icon)}
                        </div>
                        <button
                          type="button"
                          class="min-w-0 flex-1 text-left"
                          onclick={() => void navigateToList(list)}
                        >
                          <p class={`truncate text-sm ${list.selected ? 'font-bold text-warm-text-primary' : 'font-semibold text-warm-text-secondary'}`}>
                            {list.name}
                          </p>
                          <p class="mt-1 text-[11px] text-warm-text-secondary">{list.description}</p>
                        </button>
                        <div class="relative">
                          <button
                            type="button"
                            class="rounded-full px-2 py-1 text-sm text-warm-text-secondary"
                            aria-label={`List actions for ${list.name}`}
                            onclick={() => {
                              menuTargetPublicId = menuTargetPublicId === list.publicId ? null : list.publicId;
                            }}
                          >
                            •••
                          </button>

                          {#if menuTargetPublicId === list.publicId}
                            <div class="absolute right-0 top-8 z-20 w-36 rounded-2xl border border-warm-border bg-warm-bg-card p-2 shadow-[0_20px_40px_rgba(61,46,34,0.16)]">
                              <button
                                type="button"
                                class="flex w-full rounded-xl px-3 py-2 text-left text-sm text-warm-text-primary hover:bg-warm-bg"
                                onclick={() => beginRename(list)}
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                class="flex w-full rounded-xl px-3 py-2 text-left text-sm text-warm-accent hover:bg-warm-bg"
                                onclick={() => beginDelete(list)}
                              >
                                Delete
                              </button>
                            </div>
                          {/if}
                        </div>
                      </div>
                    </div>
                  {/each}
                {:else}
                  <p class="text-sm text-warm-text-secondary">No {listFilter} lists yet.</p>
                {/if}
              </div>
            </aside>

            <div class="min-w-0 flex-1">
              <div class="flex min-[1200px]:hidden">
                <div class="w-full text-warm-text-primary">
                  <div class="flex items-center justify-between pb-4">
                    <button
                      type="button"
                      class="rounded-full border border-[rgb(29_26_20_/_14%)] px-4 py-2 text-sm font-bold text-warm-text-secondary"
                      onclick={() => (showListPicker = true)}
                    >
                      {screen.title} ▾
                    </button>
                    <button
                      type="button"
                      class="flex h-9 w-9 items-center justify-center rounded-full bg-warm-accent text-base font-bold text-white"
                      onclick={() => {
                        showCreateDialog = true;
                        createVisibility = selectedPresentedList?.visibility ?? 'personal';
                      }}
                    >
                      +
                    </button>
                  </div>

                  <div>
                    <p class="text-xs text-warm-text-secondary">{screen.metaLabel}</p>
                    <div class="mt-4 flex items-center justify-between gap-4">
                      <h2 class="font-warm-display text-[20px] leading-tight">Items</h2>
                      <div class="flex items-center gap-2">
                        <button type="button" class="rounded-full bg-warm-text-primary px-4 py-2 text-xs font-bold text-warm-text-on-dark">
                          Auto
                        </button>
                        <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full bg-warm-section-mortgage text-xs text-warm-text-secondary">
                          ⌕
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      class="mt-4 flex w-full items-center gap-3 rounded-2xl border border-warm-border bg-warm-bg px-4 py-3 text-left text-[13px] text-warm-text-tertiary"
                    >
                      <span class="text-warm-accent">＋</span>
                      Add item or paste a recipe...
                    </button>

                    <div class="mt-4 flex flex-col gap-3">
                      {#each screen.categories as category (category.id)}
                        <section class={`rounded-[18px] ${category.collapsed ? 'bg-warm-section-mortgage' : 'border border-warm-border bg-warm-bg-card'} p-[14px]`}>
                          <div class="flex items-center gap-2">
                            <span class="text-sm text-warm-text-secondary">{category.collapsed ? '›' : '⌄'}</span>
                            <h3 class="flex-1 text-sm font-bold">{category.title}</h3>
                            {#if !category.collapsed}
                              <span class={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                category.sourceTone === 'sage'
                                  ? 'bg-warm-section-income text-warm-positive'
                                  : 'bg-warm-section-mortgage text-warm-text-secondary'
                              }`}>
                                {category.sourceLabel}
                              </span>
                              <span class="text-xs text-warm-text-secondary">{category.items.length} items</span>
                            {:else}
                              <span class="text-xs text-warm-text-secondary">{category.collapsedCountLabel}</span>
                            {/if}
                          </div>

                          {#if !category.collapsed}
                            <div class="mt-3 flex flex-col gap-1">
                              {#each category.items as item (item.id)}
                                <button
                                  type="button"
                                  class={`flex items-center gap-3 rounded-xl px-1 py-2 text-left ${
                                    item.selected ? 'bg-warm-bg' : ''
                                  }`}
                                  onclick={() => openItem(item)}
                                >
                                  <span class={`h-5 w-5 rounded-md border-2 ${
                                    item.selected
                                      ? 'border-warm-accent bg-warm-section-spend'
                                      : 'border-warm-section-income'
                                  }`}></span>
                                  <span class="min-w-0 flex-1">
                                    <span class={`block truncate text-sm ${item.selected ? 'font-bold' : 'font-semibold'}`}>
                                      {item.title}
                                    </span>
                                  </span>
                                  {#if item.tagLabel}
                                    <span class={`rounded-full px-2 py-1 text-[10px] font-medium ${
                                      item.tagTone === 'butter'
                                        ? 'bg-warm-card-butter text-[#D9893A]'
                                        : 'bg-warm-section-mortgage text-warm-text-secondary'
                                    }`}>
                                      {item.tagLabel}
                                    </span>
                                  {/if}
                                  {#if item.dueLabel}
                                    <span class={`text-xs ${item.dueTone === 'accent' ? 'font-bold text-warm-accent' : 'text-warm-text-secondary'}`}>
                                      {item.dueLabel}
                                    </span>
                                  {/if}
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </section>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>

              <div class="hidden min-h-full gap-5 min-[1200px]:flex">
                <section class="flex min-w-0 flex-1 flex-col gap-4">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <h2 class="font-warm-display text-[30px] leading-none text-warm-text-primary">
                        {screen.title}
                      </h2>
                      <p class="mt-1 text-xs text-warm-text-secondary">{screen.metaLabel}</p>
                    </div>
                    <div class="flex items-center gap-[10px]">
                      <button type="button" class="rounded-full bg-warm-text-primary px-[14px] py-[10px] text-sm font-semibold text-warm-text-on-dark">
                        Auto category
                      </button>
                      <button type="button" class="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-warm-bg-dark-muted text-sm text-warm-text-on-dark">
                        ⌕
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="flex items-center gap-[10px] rounded-2xl border border-warm-border bg-warm-bg px-[14px] py-3 text-left text-[13px] text-warm-text-tertiary"
                  >
                    <span class="text-lg leading-none text-warm-accent">＋</span>
                    <span class="flex-1">Add milk, bread, or paste a recipe...</span>
                    <span class="rounded-full bg-warm-card-butter px-3 py-2 text-[11px] font-bold text-[#D9893A]">
                      Due date
                    </span>
                  </button>

                  <div class="flex flex-1 flex-col gap-3">
                    {#each screen.categories as category (category.id)}
                      <section class={`rounded-[18px] ${category.collapsed ? 'bg-warm-section-mortgage' : 'border border-warm-border bg-warm-bg-card'} p-[14px]`}>
                        <div class="flex items-center gap-2">
                          <span class="text-sm text-warm-text-secondary">{category.collapsed ? '›' : '⌄'}</span>
                          <h3 class="flex-1 text-sm font-bold">{category.title}</h3>
                          {#if !category.collapsed}
                            <span class={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                              category.sourceTone === 'sage'
                                ? 'bg-warm-section-income text-warm-positive'
                                : 'bg-warm-section-mortgage text-warm-text-secondary'
                            }`}>
                              {category.sourceLabel}
                            </span>
                            <span class="text-xs text-warm-text-secondary">{category.items.length} items</span>
                          {:else}
                            <span class="text-xs text-warm-text-secondary">{category.collapsedCountLabel}</span>
                          {/if}
                        </div>

                        {#if !category.collapsed}
                          <div class="mt-3 flex flex-col gap-1">
                            {#each category.items as item (item.id)}
                              <button
                                type="button"
                                class={`flex items-center gap-3 rounded-xl px-1 py-2 text-left ${item.selected ? 'bg-warm-bg' : ''}`}
                                onclick={() => openItem(item)}
                              >
                                <span class={`h-5 w-5 rounded-md border-2 ${
                                  item.selected
                                    ? 'border-warm-accent bg-warm-section-spend'
                                    : 'border-warm-section-income'
                                }`}></span>
                                <span class="min-w-0 flex-1">
                                  <span class={`block truncate text-sm ${item.selected ? 'font-bold' : 'font-semibold'}`}>
                                    {item.title}
                                  </span>
                                </span>
                                {#if item.tagLabel}
                                  <span class={`rounded-full px-2 py-1 text-[10px] font-medium ${
                                    item.tagTone === 'butter'
                                      ? 'bg-warm-card-butter text-[#D9893A]'
                                      : 'bg-warm-section-mortgage text-warm-text-secondary'
                                  }`}>
                                    {item.tagLabel}
                                  </span>
                                {/if}
                                {#if item.dueLabel}
                                  <span class={`w-[72px] text-right text-xs ${item.dueTone === 'accent' ? 'font-bold text-warm-accent' : 'text-warm-text-secondary'}`}>
                                    {item.dueLabel}
                                  </span>
                                {/if}
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </section>
                    {/each}
                  </div>
                </section>

                <aside class="w-[274px] shrink-0 rounded-[20px] border border-warm-border bg-warm-bg p-[18px]">
                  <div class="flex items-center justify-between">
                    <p class="text-sm font-semibold text-warm-text-primary">Item details</p>
                    <button type="button" class="text-sm text-warm-text-secondary">×</button>
                  </div>

                  <div class="mt-4 rounded-[18px] bg-warm-section-spend p-4">
                    <div class="flex h-7 w-7 items-center justify-center rounded-full bg-warm-bg text-xs font-bold text-warm-accent">
                      S
                    </div>
                    <h3 class="mt-3 font-warm-display text-[28px] leading-none text-warm-text-primary">
                      {selectedItemDetail.title}
                    </h3>
                    <p class="mt-2 text-xs text-warm-text-secondary">{selectedItemDetail.meta}</p>
                  </div>

                  <div class="mt-4 flex flex-col gap-2">
                    {#each selectedItemDetail.properties as property (property.label)}
                      <div class="flex items-center justify-between py-2 text-xs">
                        <span class="text-warm-text-secondary">{property.label}</span>
                        <span class={property.accent ? 'font-bold text-warm-accent' : 'font-bold text-warm-text-primary'}>
                          {property.value}
                        </span>
                      </div>
                    {/each}
                  </div>

                  <div class="mt-4 rounded-2xl border border-warm-border bg-warm-bg-card p-[14px]">
                    <p class="text-xs font-bold text-warm-text-primary">Notes</p>
                    <p class="mt-2 text-xs leading-5 text-warm-text-secondary">{selectedItemDetail.note}</p>
                  </div>

                  <button
                    type="button"
                    class="mt-4 flex w-full items-center justify-center rounded-full bg-warm-text-primary px-4 py-3 text-sm font-bold text-warm-text-on-dark"
                  >
                    Mark as bought
                  </button>
                </aside>
              </div>
      </div>
    </div>

    {#if uiMode === 'mobile' && showListPicker}
      <button
        type="button"
        class="fixed inset-0 z-40 bg-black/30"
        aria-label="Close list picker"
        onclick={() => (showListPicker = false)}
      ></button>
      <section class="fixed inset-x-0 bottom-0 z-50 max-h-[76dvh] overflow-auto rounded-t-[18px] bg-warm-bg-card p-[14px] shadow-[0_-20px_50px_rgb(0_0_0_/_20%)]">
        <div class="mx-auto h-[5px] w-11 rounded-full bg-[rgb(29_26_20_/_14%)]"></div>
        <div class="mt-3 flex items-center justify-between">
          <h2 class="text-base font-bold text-warm-text-primary">Switch list</h2>
          <button type="button" class="text-sm text-warm-text-secondary" onclick={() => (showListPicker = false)}>×</button>
        </div>

        <div class="mt-3 rounded-full bg-warm-section-mortgage px-4 py-3 text-[13px] text-warm-text-tertiary">
          Search lists
        </div>

        <div class="mt-3 flex rounded-full bg-warm-section-mortgage p-1">
          <button
            type="button"
            class={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${
              listFilter === 'personal'
                ? 'bg-warm-text-primary text-warm-text-on-dark'
                : 'text-warm-text-secondary'
            }`}
            onclick={() => (listFilter = 'personal')}
          >
            Personal
          </button>
          <button
            type="button"
            class={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${
              listFilter === 'shared'
                ? 'bg-warm-text-primary text-warm-text-on-dark'
                : 'text-warm-text-secondary'
            }`}
            onclick={() => (listFilter = 'shared')}
          >
            Shared
          </button>
        </div>

        <div class="mt-4 flex flex-col gap-3">
          {#each filteredLists as list (list.publicId)}
            <div class={`rounded-2xl p-[12px_14px] ${list.selected ? 'border border-warm-accent bg-warm-section-spend' : ''}`}>
              <div class="flex items-center gap-3">
                <div class={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold ${
                  list.selected ? 'bg-warm-bg text-warm-text-primary' : 'bg-warm-section-mortgage text-warm-text-secondary'
                }`}>
                  {listIcon(list.icon)}
                </div>
                <button type="button" class="min-w-0 flex-1 text-left" onclick={() => void navigateToList(list)}>
                  <p class={`truncate text-sm ${list.selected ? 'font-bold text-warm-text-primary' : 'font-semibold text-warm-text-secondary'}`}>
                    {list.name}
                  </p>
                  <p class="text-[11px] text-warm-text-tertiary">{list.description}</p>
                </button>
                <button
                  type="button"
                  class="text-sm text-warm-text-secondary"
                  onclick={() => {
                    menuTargetPublicId = menuTargetPublicId === list.publicId ? null : list.publicId;
                  }}
                >
                  •••
                </button>
              </div>

              {#if menuTargetPublicId === list.publicId}
                <div class="mt-3 flex gap-2">
                  <button
                    type="button"
                    class="flex-1 rounded-full bg-warm-bg px-3 py-2 text-sm font-medium text-warm-text-primary"
                    onclick={() => beginRename(list)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    class="flex-1 rounded-full bg-warm-bg px-3 py-2 text-sm font-medium text-warm-accent"
                    onclick={() => beginDelete(list)}
                  >
                    Delete
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <button
          type="button"
          class="mt-4 flex w-full items-center justify-center rounded-full bg-warm-text-primary px-4 py-3 text-sm font-bold text-warm-text-on-dark"
          onclick={() => {
            showCreateDialog = true;
            createVisibility = listFilter;
          }}
        >
          + New list
        </button>
      </section>
    {/if}

    {#if uiMode === 'mobile' && showItemSheet && currentItem}
      <button
        type="button"
        class="fixed inset-0 z-40 bg-black/30"
        aria-label="Close item details"
        onclick={() => (showItemSheet = false)}
      ></button>
      <section class="fixed inset-x-0 bottom-0 z-50 max-h-[76dvh] overflow-auto rounded-t-[18px] bg-warm-bg-card p-[14px] shadow-[0_-20px_50px_rgb(0_0_0_/_20%)]">
        <div class="mx-auto h-[5px] w-11 rounded-full bg-[rgb(29_26_20_/_14%)]"></div>
        <div class="mt-3 flex items-center justify-between">
          <p class="text-sm font-semibold text-warm-text-primary">Item details</p>
          <button type="button" class="text-sm text-warm-text-secondary" onclick={() => (showItemSheet = false)}>×</button>
        </div>

        <div class="mt-4 rounded-[18px] bg-warm-section-spend p-4">
          <div class="flex h-7 w-7 items-center justify-center rounded-full bg-warm-bg text-xs font-bold text-warm-accent">
            S
          </div>
          <h3 class="mt-3 font-warm-display text-[28px] leading-none text-warm-text-primary">
            {selectedItemDetail.title}
          </h3>
          <p class="mt-2 text-xs text-warm-text-secondary">{selectedItemDetail.meta}</p>
        </div>

        <div class="mt-4 flex flex-col gap-2">
          {#each selectedItemDetail.properties as property (property.label)}
            <div class="flex items-center justify-between py-2 text-xs">
              <span class="text-warm-text-secondary">{property.label}</span>
              <span class={property.accent ? 'font-bold text-warm-accent' : 'font-bold text-warm-text-primary'}>
                {property.value}
              </span>
            </div>
          {/each}
        </div>

        <div class="mt-4 rounded-2xl border border-warm-border bg-warm-bg-card p-[14px]">
          <p class="text-xs font-bold text-warm-text-primary">Notes</p>
          <p class="mt-2 text-xs leading-5 text-warm-text-secondary">{selectedItemDetail.note}</p>
        </div>

        <button
          type="button"
          class="mt-4 flex w-full items-center justify-center rounded-full bg-warm-text-primary px-4 py-3 text-sm font-bold text-warm-text-on-dark"
        >
          Mark as bought
        </button>
      </section>
    {/if}

    {#if showCreateDialog || renameTargetPublicId || deleteTargetPublicId}
      <button
        type="button"
        class="fixed inset-0 z-40 bg-[#2D2D2D99]"
        aria-label="Close dialog"
        onclick={() => {
          showCreateDialog = false;
          renameTargetPublicId = null;
          deleteTargetPublicId = null;
          menuTargetPublicId = null;
        }}
      ></button>

      <section class="fixed inset-x-4 top-1/2 z-50 max-w-md -translate-y-1/2 rounded-[28px] border border-warm-border bg-warm-bg-card p-5 shadow-[0_24px_60px_rgba(61,46,34,0.2)] min-[1200px]:left-1/2 min-[1200px]:right-auto min-[1200px]:w-full min-[1200px]:-translate-x-1/2">
        {#if showCreateDialog}
          <h2 class="font-warm-display text-[26px] text-warm-text-primary">New list</h2>
          <p class="mt-2 text-sm text-warm-text-secondary">Create a personal or shared list.</p>

          <form
            class="mt-5 flex flex-col gap-3"
            onsubmit={(event) => {
              event.preventDefault();
              void handleCreateList();
            }}
          >
            <input
              bind:value={createName}
              class="rounded-2xl border border-warm-border bg-warm-bg px-4 py-3 text-sm text-warm-text-primary outline-none ring-0"
              placeholder="Weekly shop"
            />

            <div class="flex rounded-full bg-warm-section-mortgage p-1">
              <button
                type="button"
                class={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${
                  createVisibility === 'personal'
                    ? 'bg-warm-text-primary text-warm-text-on-dark'
                    : 'text-warm-text-secondary'
                }`}
                onclick={() => (createVisibility = 'personal')}
              >
                Personal
              </button>
              <button
                type="button"
                class={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${
                  createVisibility === 'shared'
                    ? 'bg-warm-text-primary text-warm-text-on-dark'
                    : 'text-warm-text-secondary'
                }`}
                onclick={() => (createVisibility = 'shared')}
              >
                Shared
              </button>
            </div>

            <div class="mt-2 flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-full border border-warm-border px-4 py-3 text-sm font-medium text-warm-text-secondary"
                onclick={() => (showCreateDialog = false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 rounded-full bg-warm-text-primary px-4 py-3 text-sm font-bold text-warm-text-on-dark disabled:opacity-60"
                disabled={!createName.trim()}
              >
                Create list
              </button>
            </div>
          </form>
        {:else if renameTargetPublicId}
          <h2 class="font-warm-display text-[26px] text-warm-text-primary">Rename list</h2>
          <p class="mt-2 text-sm text-warm-text-secondary">Update the list name and canonical slug.</p>

          <form
            class="mt-5 flex flex-col gap-3"
            onsubmit={(event) => {
              event.preventDefault();
              void handleRenameList();
            }}
          >
            <input
              bind:value={renameName}
              class="rounded-2xl border border-warm-border bg-warm-bg px-4 py-3 text-sm text-warm-text-primary outline-none ring-0"
              placeholder="List name"
            />

            <div class="mt-2 flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-full border border-warm-border px-4 py-3 text-sm font-medium text-warm-text-secondary"
                onclick={() => {
                  renameTargetPublicId = null;
                  menuTargetPublicId = null;
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 rounded-full bg-warm-text-primary px-4 py-3 text-sm font-bold text-warm-text-on-dark disabled:opacity-60"
                disabled={!renameName.trim()}
              >
                Save
              </button>
            </div>
          </form>
        {:else if deleteTargetPublicId}
          <h2 class="font-warm-display text-[26px] text-warm-text-primary">Delete list</h2>
          <p class="mt-2 text-sm text-warm-text-secondary">This removes the list from the picker and active route.</p>

          <div class="mt-5 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-full border border-warm-border px-4 py-3 text-sm font-medium text-warm-text-secondary"
              onclick={() => {
                deleteTargetPublicId = null;
                menuTargetPublicId = null;
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              class="flex-1 rounded-full bg-warm-accent px-4 py-3 text-sm font-bold text-warm-text-on-dark"
              onclick={() => void handleDeleteList()}
            >
              Delete
            </button>
          </div>
        {/if}

        {#if mutationError}
          <p class="mt-3 text-sm text-warm-accent">{mutationError}</p>
        {/if}
      </section>
    {/if}
  </section>
{/if}
