<script lang="ts">
  import { api } from '@repo/convex';
  import { slugifyListName } from '@repo/convex/lists/model';
  import { useMutation, useQuery } from 'convex-svelte';

  import { browser, dev } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import {
    describeListMeta,
    type PresentedList,
    presentLists,
    previewItemsByListPublicId,
    previewVisibleLists,
    projectDraggedItems,
    type VisibleList,
    type VisibleListItem,
    type VisibleListItemsResult
  } from '$lib/lists-presenter';
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

  const visibleLists = useQuery(api.lists.queries.listVisibleToMe, () => (USE_DEV_FIXTURE ? 'skip' : {}));
  const listItems = useQuery(api.lists.queries.getVisibleListItemsByPublicId, () =>
    USE_DEV_FIXTURE || !selectedPublicId ? 'skip' : { publicId: selectedPublicId }
  );

  const createList = useMutation(api.lists.mutations.createList);
  const renameList = useMutation(api.lists.mutations.renameList);
  const deleteList = useMutation(api.lists.mutations.deleteList);
  const createListItem = useMutation(api.lists.mutations.createListItem);
  const renameListItem = useMutation(api.lists.mutations.renameListItem);
  const deleteListItem = useMutation(api.lists.mutations.deleteListItem);
  const completeListItem = useMutation(api.lists.mutations.completeListItem);
  const uncompleteListItem = useMutation(api.lists.mutations.uncompleteListItem);
  const reorderListItem = useMutation(api.lists.mutations.reorderListItem);
  const clearCompletedListItems = useMutation(api.lists.mutations.clearCompletedListItems);

  let createName = $state('');
  let createVisibility = $state<'personal' | 'shared'>('personal');
  let renameName = $state('');
  let renameSeededFor = $state<string | null>(null);
  let mutationError = $state<string | null>(null);
  let itemDraft = $state('');
  let itemMutationError = $state<string | null>(null);
  let listFilter = $state<'personal' | 'shared'>('personal');
  let menuTargetPublicId = $state<string | null>(null);
  let renameTargetPublicId = $state<string | null>(null);
  let deleteTargetPublicId = $state<string | null>(null);
  let showCreateDialog = $state(false);
  let editingItemId = $state<string | null>(null);
  let editingItemTitle = $state('');
  let draggingItemId = $state<string | null>(null);
  let dragOverItemId = $state<string | null>(null);
  let usePreviewData = $state(USE_DEV_FIXTURE);
  let previewLists = $state([...previewVisibleLists]);
  let previewItemsByList = $state(structuredClone(previewItemsByListPublicId));

  function describeError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : null;
    if (!message) return fallback;
    if (message.includes('Not authenticated')) return 'Sign in to load and edit household lists.';
    if (message.includes('List unavailable')) return 'This list may have been deleted or is no longer visible to you.';
    if (message.includes('List item unavailable')) return 'This item is unavailable.';
    return message;
  }

  function normalizePreviewItems(items: VisibleListItem[]) {
    return items.map((item, index) => ({ ...item, sortOrder: index }));
  }

  function updatePreviewListData(publicId: string, updater: (current: VisibleListItemsResult) => VisibleListItemsResult) {
    const current = previewItemsByList[publicId];
    if (!current) return;

    previewItemsByList = {
      ...previewItemsByList,
      [publicId]: updater(current)
    };
  }

  function closeMenus() {
    menuTargetPublicId = null;
  }

  async function navigateToList(list: { publicId: string; slug: string }) {
    closeMenus();
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
      } satisfies VisibleList;

      previewLists = [created, ...previewLists];
      previewItemsByList = {
        ...previewItemsByList,
        [created.publicId]: {
          list: created,
          activeItems: [],
          completedItems: []
        }
      };
      createName = '';
      showCreateDialog = false;
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
      const slug = slugifyListName(name);

      previewLists = previewLists.map((list) =>
        list.publicId === renameTargetPublicId ? { ...list, name, slug } : list
      );

      const current = previewItemsByList[renameTargetPublicId];
      if (current) {
        const nextPublicId = renameTargetPublicId === slug ? renameTargetPublicId : slug;
        const nextList = { ...current.list, name, slug, publicId: nextPublicId };
        const rest = { ...previewItemsByList };
        delete rest[renameTargetPublicId];
        previewItemsByList = {
          ...rest,
          [nextPublicId]: {
            ...current,
            list: nextList
          }
        };
      }

      const renamed = previewLists.find((list) => list.slug === slug && list.name === name);
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

    const remaining = presentedLists.filter((list) => list.publicId !== deleteTargetPublicId);

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
      const rest = { ...previewItemsByList };
      delete rest[deleteTargetPublicId];
      previewItemsByList = rest;
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

  async function handleCreateItem() {
    if (!selectedRow?.publicId) return;
    itemMutationError = null;

    if (usePreviewData) {
      updatePreviewListData(selectedRow.publicId, (current) => {
        const nextItem: VisibleListItem = {
          _id: `preview-item-${crypto.randomUUID()}`,
          listId: current.list._id,
          title: itemDraft.trim(),
          sortOrder: current.activeItems.length,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        return {
          ...current,
          activeItems: [...current.activeItems, nextItem]
        };
      });
      itemDraft = '';
      return;
    }

    try {
      await createListItem({
        listPublicId: selectedRow.publicId,
        title: itemDraft
      });
      itemDraft = '';
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to add item.');
    }
  }

  function beginEditingItem(item: VisibleListItem) {
    editingItemId = item._id;
    editingItemTitle = item.title;
    itemMutationError = null;
  }

  async function saveEditedItem() {
    if (!editingItemId) return;
    itemMutationError = null;

    if (usePreviewData) {
      if (!selectedRow?.publicId) return;
      updatePreviewListData(selectedRow.publicId, (current) => ({
        ...current,
        activeItems: current.activeItems.map((item) =>
          item._id === editingItemId ? { ...item, title: editingItemTitle.trim(), updatedAt: Date.now() } : item
        ),
        completedItems: current.completedItems.map((item) =>
          item._id === editingItemId ? { ...item, title: editingItemTitle.trim(), updatedAt: Date.now() } : item
        )
      }));
      editingItemId = null;
      editingItemTitle = '';
      return;
    }

    try {
      await renameListItem({
        itemId: editingItemId as never,
        title: editingItemTitle
      });
      editingItemId = null;
      editingItemTitle = '';
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to rename item.');
    }
  }

  async function removeItem(itemId: string) {
    itemMutationError = null;

    if (usePreviewData) {
      if (!selectedRow?.publicId) return;
      updatePreviewListData(selectedRow.publicId, (current) => ({
        ...current,
        activeItems: normalizePreviewItems(current.activeItems.filter((item) => item._id !== itemId)),
        completedItems: current.completedItems.filter((item) => item._id !== itemId)
      }));
      return;
    }

    try {
      await deleteListItem({ itemId: itemId as never });
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to delete item.');
    }
  }

  async function toggleItemCompletion(item: VisibleListItem) {
    itemMutationError = null;

    if (usePreviewData) {
      if (!selectedRow?.publicId) return;
      updatePreviewListData(selectedRow.publicId, (current) => {
        if (item.completedAt === undefined) {
          const activeItems = normalizePreviewItems(current.activeItems.filter((entry) => entry._id !== item._id));
          const completedItems = [
            { ...item, completedAt: Date.now(), updatedAt: Date.now() },
            ...current.completedItems
          ];
          return { ...current, activeItems, completedItems };
        }

        const activeItems = [
          ...current.activeItems,
          {
            ...item,
            completedAt: undefined,
            sortOrder: current.activeItems.length,
            updatedAt: Date.now()
          }
        ];
        const completedItems = current.completedItems.filter((entry) => entry._id !== item._id);
        return { ...current, activeItems, completedItems };
      });
      return;
    }

    try {
      if (item.completedAt === undefined) {
        await completeListItem({ itemId: item._id as never });
      } else {
        await uncompleteListItem({ itemId: item._id as never });
      }
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to update item.');
    }
  }

  async function handleClearCompletedItems() {
    if (!selectedRow?.publicId) return;
    itemMutationError = null;

    if (usePreviewData) {
      updatePreviewListData(selectedRow.publicId, (current) => ({
        ...current,
        completedItems: []
      }));
      return;
    }

    try {
      await clearCompletedListItems({
        listPublicId: selectedRow.publicId
      });
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to clear completed items.');
    }
  }

  async function persistPreviewReorder(itemId: string, targetItemId: string) {
    if (!selectedRow?.publicId) return;
    updatePreviewListData(selectedRow.publicId, (current) => {
      const dragged = projectDraggedItems(current.activeItems, itemId, targetItemId);
      return {
        ...current,
        activeItems: normalizePreviewItems(dragged)
      };
    });
  }

  async function persistItemReorder(itemId: string, targetItemId: string) {
    const baseItems = selectedListData?.activeItems ?? [];
    const targetIndex = baseItems.findIndex((item) => item._id === targetItemId);
    if (targetIndex < 0) return;

    if (usePreviewData) {
      await persistPreviewReorder(itemId, targetItemId);
      return;
    }

    try {
      await reorderListItem({
        itemId: itemId as never,
        targetIndex
      });
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to reorder item.');
    }
  }

  function startDragging(itemId: string, event: PointerEvent) {
    if (!browser) return;

    event.preventDefault();
    itemMutationError = null;
    draggingItemId = itemId;
    dragOverItemId = itemId;

    const move = (moveEvent: PointerEvent) => {
      const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest<HTMLElement>('[data-active-item-id]');
      if (row?.dataset.activeItemId) {
        dragOverItemId = row.dataset.activeItemId;
      }
    };

    const finish = async () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);

      const draggedItemId = draggingItemId;
      const targetItemId = dragOverItemId;
      draggingItemId = null;
      dragOverItemId = null;

      if (!draggedItemId || !targetItemId || draggedItemId === targetItemId) return;
      await persistItemReorder(draggedItemId, targetItemId);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  const visibleListRows = $derived(usePreviewData ? previewLists : (visibleLists.data ?? []));
  const previewSelectedListData = $derived(
    selectedPublicId ? previewItemsByList[selectedPublicId] ?? null : null
  );
  const selectedListData = $derived(
    usePreviewData
      ? previewSelectedListData ?? (visibleListRows[0] ? previewItemsByList[visibleListRows[0].publicId] ?? null : null)
      : listItems.data ?? null
  );
  const selectedRow = $derived(selectedListData?.list ?? null);
  const presentedLists = $derived(presentLists(visibleListRows, selectedRow?.publicId ?? selectedPublicId));
  const filteredLists = $derived(presentedLists.filter((list) => list.visibility === listFilter));
  const activeItems = $derived(
    projectDraggedItems(selectedListData?.activeItems ?? [], draggingItemId, dragOverItemId)
  );
  const completedItems = $derived(selectedListData?.completedItems ?? []);
  const metaLabel = $derived(
    describeListMeta(selectedRow, selectedListData?.activeItems.length ?? 0, selectedListData?.completedItems.length ?? 0)
  );

  $effect(() => {
    if (!browser) return;
    const row = selectedRow;
    if (!row?.publicId) return;
    writeLastListPublicId(row.publicId);
  });

  $effect(() => {
    if (!browser || selectedPublicId) return;
    const rows = visibleListRows;
    if (!rows.length) return;

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

  $effect(() => {
    if (!browser || !dev || usePreviewData) return;
    if (visibleLists.data || visibleLists.error || listItems.data || listItems.error) return;

    const timeoutId = window.setTimeout(() => {
      usePreviewData = true;
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  });
</script>

{#if selectedPublicId && !usePreviewData && listItems.data === null && !listItems.isLoading}
  <section class="rounded-[32px] border border-warm-border bg-warm-bg-card p-8 text-sm text-warm-text-secondary">
    This list is unavailable.
  </section>
{:else if !usePreviewData && (visibleLists.isLoading || (selectedPublicId && listItems.isLoading))}
  <section aria-hidden="true" class="sr-only">Loading Lists...</section>
{:else if !usePreviewData && visibleLists.error}
  <section class="rounded-[32px] border border-warm-border bg-warm-bg-card p-8 text-sm text-warm-text-secondary">
    {describeError(visibleLists.error, 'Unable to load lists right now.')}
  </section>
{:else}
  <section class="flex min-h-full flex-col gap-4 text-warm-text-primary min-[1100px]:flex-row">
    <aside class="rounded-[28px] border border-warm-border bg-warm-bg-card p-5 shadow-[0_18px_44px_rgb(20_17_12_/_10%)] min-[1100px]:w-[300px]">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-warm-text-primary">My Lists</h2>
          <p class="mt-1 text-xs text-warm-text-secondary">Plain working household lists.</p>
        </div>
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

      <div class="mt-4 flex rounded-full bg-warm-section-mortgage p-1">
        <button
          type="button"
          class={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${
            listFilter === 'personal' ? 'bg-warm-text-primary text-warm-text-on-dark' : 'text-warm-text-secondary'
          }`}
          onclick={() => (listFilter = 'personal')}
        >
          Personal
        </button>
        <button
          type="button"
          class={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${
            listFilter === 'shared' ? 'bg-warm-text-primary text-warm-text-on-dark' : 'text-warm-text-secondary'
          }`}
          onclick={() => (listFilter = 'shared')}
        >
          Shared
        </button>
      </div>

      <div class="mt-4 flex flex-col gap-3">
        {#if filteredLists.length}
          {#each filteredLists as list (list.publicId)}
            <div
              class={`rounded-2xl border p-[14px] ${
                list.selected ? 'border-warm-accent bg-warm-section-spend' : 'border-warm-border bg-warm-bg-card'
              }`}
            >
              <div class="flex items-start gap-3">
                <button type="button" class="min-w-0 flex-1 text-left" onclick={() => void navigateToList(list)}>
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

    <section class="min-w-0 flex-1 rounded-[28px] border border-warm-border bg-warm-bg-card p-5 shadow-[0_18px_44px_rgb(20_17_12_/_10%)]">
      {#if selectedRow}
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-2 min-[700px]:flex-row min-[700px]:items-end min-[700px]:justify-between">
            <div>
              <p class="text-xs text-warm-text-secondary">{metaLabel}</p>
              <h2 class="font-warm-display text-[28px] leading-none text-warm-text-primary min-[700px]:text-[34px]">
                {selectedRow.name}
              </h2>
            </div>
          </div>

          <form
            class="flex flex-col gap-2 rounded-[24px] border border-warm-border bg-warm-bg p-3 min-[700px]:flex-row"
            onsubmit={(event) => {
              event.preventDefault();
              void handleCreateItem();
            }}
          >
            <input
              bind:value={itemDraft}
              class="flex-1 rounded-2xl bg-transparent px-2 py-2 text-sm text-warm-text-primary outline-none"
              placeholder="Add an item"
            />
            <button
              type="submit"
              class="rounded-full bg-warm-text-primary px-4 py-2 text-sm font-semibold text-warm-text-on-dark disabled:opacity-60"
              disabled={!itemDraft.trim()}
            >
              Add item
            </button>
          </form>

          {#if itemMutationError}
            <p class="text-sm text-warm-accent">{itemMutationError}</p>
          {/if}

          <div class="grid gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_260px]">
            <div class="flex flex-col gap-4">
              <section class="rounded-[24px] border border-warm-border bg-warm-bg p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h3 class="text-sm font-bold text-warm-text-primary">Active items</h3>
                    <p class="mt-1 text-xs text-warm-text-secondary">Drag by the handle to reorder.</p>
                  </div>
                  <span class="rounded-full bg-warm-section-mortgage px-3 py-1 text-[11px] font-semibold text-warm-text-secondary">
                    {activeItems.length}
                  </span>
                </div>

                {#if activeItems.length}
                  <ul class="mt-4 flex flex-col gap-2">
                    {#each activeItems as item (item._id)}
                      <li
                        data-active-item-id={item._id}
                        class={`rounded-2xl border px-3 py-3 ${
                          draggingItemId === item._id
                            ? 'border-warm-accent bg-warm-section-spend'
                            : dragOverItemId === item._id
                              ? 'border-warm-accent/60 bg-warm-section-spend/60'
                              : 'border-warm-border bg-warm-bg-card'
                        }`}
                      >
                        {#if editingItemId === item._id}
                          <form
                            class="flex flex-col gap-2 min-[700px]:flex-row"
                            onsubmit={(event) => {
                              event.preventDefault();
                              void saveEditedItem();
                            }}
                          >
                            <input
                              bind:value={editingItemTitle}
                              class="flex-1 rounded-2xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
                            />
                            <div class="flex gap-2">
                              <button
                                type="button"
                                class="rounded-full border border-warm-border px-3 py-2 text-xs font-semibold text-warm-text-secondary"
                                onclick={() => {
                                  editingItemId = null;
                                  editingItemTitle = '';
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                class="rounded-full bg-warm-text-primary px-3 py-2 text-xs font-semibold text-warm-text-on-dark disabled:opacity-60"
                                disabled={!editingItemTitle.trim()}
                              >
                                Save
                              </button>
                            </div>
                          </form>
                        {:else}
                          <div class="flex items-center gap-3">
                            <button
                              type="button"
                              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-warm-section-income"
                              aria-label={`Mark ${item.title} complete`}
                              onclick={() => void toggleItemCompletion(item)}
                            >
                              <span class="h-2.5 w-2.5 rounded-full bg-warm-section-income"></span>
                            </button>
                            <button
                              type="button"
                              class="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-full bg-warm-section-mortgage text-sm text-warm-text-secondary active:cursor-grabbing"
                              aria-label={`Drag to reorder ${item.title}`}
                              onpointerdown={(event) => startDragging(item._id, event)}
                            >
                              ≡
                            </button>
                            <span class="min-w-0 flex-1 text-sm font-semibold text-warm-text-primary">{item.title}</span>
                            <div class="flex items-center gap-2">
                              <button
                                type="button"
                                class="rounded-full border border-warm-border px-3 py-2 text-[11px] font-semibold text-warm-text-secondary"
                                onclick={() => beginEditingItem(item)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                class="rounded-full border border-warm-border px-3 py-2 text-[11px] font-semibold text-warm-accent"
                                onclick={() => void removeItem(item._id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="mt-4 text-sm text-warm-text-secondary">No active items yet.</p>
                {/if}
              </section>

              <section class="rounded-[24px] border border-warm-border bg-warm-bg p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h3 class="text-sm font-bold text-warm-text-primary">Completed items</h3>
                    <p class="mt-1 text-xs text-warm-text-secondary">Newest completions stay visible until you clear or remove them.</p>
                  </div>
                  <button
                    type="button"
                    class="rounded-full border border-warm-border px-3 py-2 text-[11px] font-semibold text-warm-text-secondary disabled:opacity-60"
                    onclick={() => void handleClearCompletedItems()}
                    disabled={!completedItems.length}
                  >
                    Clear completed
                  </button>
                </div>

                {#if completedItems.length}
                  <ul class="mt-4 flex flex-col gap-2">
                    {#each completedItems as item (item._id)}
                      <li class="rounded-2xl border border-warm-border bg-warm-bg-card px-3 py-3">
                        <div class="flex items-center gap-3">
                          <button
                            type="button"
                            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-warm-accent bg-warm-section-spend text-[11px] text-warm-accent"
                            aria-label={`Undo completion for ${item.title}`}
                            onclick={() => void toggleItemCompletion(item)}
                          >
                            ✓
                          </button>
                          <span class="min-w-0 flex-1 text-sm text-warm-text-secondary line-through">{item.title}</span>
                          <div class="flex items-center gap-2">
                            <button
                              type="button"
                              class="rounded-full border border-warm-border px-3 py-2 text-[11px] font-semibold text-warm-text-secondary"
                              onclick={() => void toggleItemCompletion(item)}
                            >
                              Undo
                            </button>
                            <button
                              type="button"
                              class="rounded-full border border-warm-border px-3 py-2 text-[11px] font-semibold text-warm-accent"
                              onclick={() => void removeItem(item._id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="mt-4 text-sm text-warm-text-secondary">No completed items yet.</p>
                {/if}
              </section>
            </div>

            <aside class="rounded-[24px] border border-warm-border bg-warm-bg p-4">
              <h3 class="text-sm font-bold text-warm-text-primary">How this list works</h3>
              <ul class="mt-3 flex list-none flex-col gap-2 text-sm text-warm-text-secondary">
                <li>Add plain text items.</li>
                <li>Drag active items into the order you want.</li>
                <li>Completed items stay visible until you clear them.</li>
              </ul>
            </aside>
          </div>
        </div>
      {:else}
        <div class="rounded-[24px] border border-warm-border bg-warm-bg p-6 text-sm text-warm-text-secondary">
          Create a list or select one from the sidebar.
        </div>
      {/if}
    </section>

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
                  createVisibility === 'shared' ? 'bg-warm-text-primary text-warm-text-on-dark' : 'text-warm-text-secondary'
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
          <p class="mt-2 text-sm text-warm-text-secondary">This removes the list and its items from the current view.</p>

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
