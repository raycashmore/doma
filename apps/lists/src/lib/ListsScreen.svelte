<script lang="ts">
  import { api } from '@repo/convex';
  import { useMutation, useQuery } from 'convex-svelte';

  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { activeItems, completedItems, selectedItemProperties } from '$lib/lists-fixtures';
  import { buildListHref, buildListsHomeHref, readLastListPublicId, writeLastListPublicId } from '$lib/lists-routing';

  let {
    selectedPublicId = null
  }: {
    selectedPublicId?: string | null;
  } = $props();

  const visibleLists = useQuery(api.lists.queries.listVisibleToMe, () => ({}));
  const selectedList = useQuery(api.lists.queries.getVisibleListByPublicId, () =>
    selectedPublicId ? { publicId: selectedPublicId } : 'skip'
  );
  const createList = useMutation(api.lists.mutations.createList);
  const renameList = useMutation(api.lists.mutations.renameList);
  const deleteList = useMutation(api.lists.mutations.deleteList);

  const selectedItem = activeItems[0];

  let createName = $state('');
  let createVisibility = $state<'personal' | 'shared'>('personal');
  let renameName = $state('');
  let renameSeededFor = $state<string | null>(null);
  let mutationError = $state<string | null>(null);

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

  function listKindLabel(visibility: 'personal' | 'shared') {
    return visibility === 'shared' ? 'Shared list' : 'Personal list';
  }

  function isSelectedListUnavailable() {
    if (!selectedPublicId || selectedList.isLoading) return false;
    if (selectedList.error) return true;
    if (visibleLists.isLoading) return false;
    return selectedList.data === null;
  }

  $effect(() => {
    if (!browser) return;
    const row = selectedList.data;
    if (!row?.publicId) return;
    writeLastListPublicId(row.publicId);
  });

  $effect(() => {
    if (!browser || selectedPublicId) return;
    const rows = visibleLists.data;
    if (!rows?.length) return;

    const lastPublicId = readLastListPublicId();
    const preferred = rows.find((row) => row.publicId === lastPublicId) ?? rows[0];
    if (!preferred) return;

    void goto(buildListHref(base, preferred), { replaceState: true, noScroll: true, keepFocus: true });
  });

  $effect(() => {
    if (!browser) return;
    const row = selectedList.data;
    if (!row || !selectedPublicId) return;
    if (row.publicId !== selectedPublicId) return;

    const canonicalHref = buildListHref(base, row);
    if (page.url.pathname === canonicalHref) return;

    void goto(canonicalHref, { replaceState: true, noScroll: true, keepFocus: true });
  });

  $effect(() => {
    const row = selectedList.data;
    if (!row || renameSeededFor === row.publicId) return;

    renameName = row.name;
    renameSeededFor = row.publicId;
  });

  async function handleCreateList() {
    mutationError = null;

    try {
      const created = await createList({
        name: createName,
        visibility: createVisibility
      });

      createName = '';
      await goto(buildListHref(base, created), { noScroll: true, keepFocus: true });
    } catch (error) {
      mutationError = error instanceof Error ? error.message : 'Unable to create list.';
    }
  }

  async function handleRenameList() {
    const row = selectedList.data;
    if (!row) return;
    mutationError = null;

    try {
      const renamed = await renameList({
        publicId: row.publicId,
        name: renameName
      });

      await goto(buildListHref(base, renamed), { replaceState: true, noScroll: true, keepFocus: true });
    } catch (error) {
      mutationError = error instanceof Error ? error.message : 'Unable to rename list.';
    }
  }

  async function handleDeleteList() {
    const row = selectedList.data;
    if (!row) return;
    mutationError = null;

    const remaining = visibleLists.data?.filter((list) => list.publicId !== row.publicId) ?? [];

    try {
      await deleteList({ publicId: row.publicId });

      const nextList = remaining[0];
      if (nextList) {
        await goto(buildListHref(base, nextList), { replaceState: true, noScroll: true, keepFocus: true });
      } else {
        await goto(buildListsHomeHref(base), { replaceState: true, noScroll: true, keepFocus: true });
      }
    } catch (error) {
      mutationError = error instanceof Error ? error.message : 'Unable to delete list.';
    }
  }
</script>

<section class="lists-screen" aria-label="Lists">
  <aside class="list-picker" aria-label="Lists">
    <div class="panel-heading">
      <p>My Lists</p>
    </div>

    <form
      class="list-form"
      onsubmit={(event) => {
        event.preventDefault();
        void handleCreateList();
      }}
    >
      <input bind:value={createName} aria-label="List name" placeholder="New list name" />

      <select bind:value={createVisibility} aria-label="List visibility">
        <option value="personal">Personal</option>
        <option value="shared">Shared</option>
      </select>

      <button type="submit" disabled={!createName.trim()}>Create list</button>
    </form>

    {#if mutationError}
      <p class="picker-error" role="alert">{mutationError}</p>
    {/if}

    {#if visibleLists.isLoading}
      <p class="picker-empty">Loading lists...</p>
    {:else if visibleLists.error}
      <p class="picker-error" role="alert">
        {describeError(visibleLists.error, 'Unable to load lists right now.')}
      </p>
    {:else if !visibleLists.data?.length}
      <p class="picker-empty">No lists yet. Create one to get started.</p>
    {:else}
      <div class="list-stack">
        {#each visibleLists.data as list (list.publicId)}
          <button
            type="button"
            class:active={list.publicId === selectedList.data?.publicId}
            onclick={() => goto(buildListHref(base, list), { noScroll: true, keepFocus: true })}
          >
            <span>
              <strong>{list.name}</strong>
              <small>{listKindLabel(list.visibility)}</small>
            </span>
          </button>
        {/each}
      </div>
    {/if}

    {#if selectedList.data}
      <form
        class="list-form list-form-secondary"
        onsubmit={(event) => {
          event.preventDefault();
          void handleRenameList();
        }}
      >
        <input bind:value={renameName} aria-label="Rename list" />

        <div class="picker-actions">
          <button type="submit" disabled={!renameName.trim()}>Rename</button>
          <button type="button" class="danger-button" onclick={() => void handleDeleteList()}>Delete</button>
        </div>
      </form>
    {/if}
  </aside>

  {#if selectedPublicId && isSelectedListUnavailable()}
    <section class="item-pane" aria-live="polite">
      <header>
        <div>
          <p>Unavailable</p>
          <h1>This list is unavailable</h1>
        </div>
      </header>

      <div class="empty-pane">
        {describeError(
          selectedList.error,
          'The list may have been deleted or may not be visible to this household user.'
        )}
      </div>
    </section>
  {:else if selectedPublicId && selectedList.isLoading}
    <section class="item-pane" aria-live="polite">
      <header>
        <div>
          <p>Loading</p>
          <h1>Opening list...</h1>
        </div>
      </header>

      <div class="empty-pane">Loading the selected list.</div>
    </section>
  {:else if visibleLists.isLoading}
    <section class="item-pane" aria-live="polite">
      <header>
        <div>
          <p>Loading</p>
          <h1>Loading lists...</h1>
        </div>
      </header>

      <div class="empty-pane">Loading the latest visible lists.</div>
    </section>
  {:else if visibleLists.error}
    <section class="item-pane" aria-live="polite">
      <header>
        <div>
          <p>Unavailable</p>
          <h1>Unable to load lists</h1>
        </div>
      </header>

      <div class="empty-pane">{describeError(visibleLists.error, 'Lists data is unavailable right now.')}</div>
    </section>
  {:else if selectedList.data}
    <section class="item-pane" aria-labelledby="active-list-title">
      <header>
        <div>
          <p>{listKindLabel(selectedList.data.visibility)}</p>
          <h1 id="active-list-title">{selectedList.data.name}</h1>
        </div>
        <button type="button">Add item</button>
      </header>

      <div class="quick-entry">Add a list item</div>

      <div class="item-section">
        <p class="section-label">Active</p>
        {#each activeItems as item (item.id)}
          <button type="button" class="list-item" class:selected={item.id === selectedItem.id}>
            <span aria-hidden="true" class="check-ring"></span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </span>
          </button>
        {/each}
      </div>

      <div class="item-section completed">
        <p class="section-label">Completed</p>
        {#each completedItems as item (item.id)}
          <button type="button" class="list-item">
            <span aria-hidden="true" class="check-ring done"></span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </span>
          </button>
        {/each}
      </div>
    </section>
  {:else}
    <section class="item-pane" aria-live="polite">
      <header>
        <div>
          <p>Lists</p>
          <h1>No lists yet</h1>
        </div>
      </header>

      <div class="empty-pane">
        Create a personal or shared list from the left picker to start using Lists.
      </div>
    </section>
  {/if}

  <aside class="detail-panel" aria-label="Item details">
    {#if selectedList.data}
      <p class="section-label">Item details</p>
      <h2>{selectedItem.title}</h2>
      <label>
        <span>Title</span>
        <input value={selectedItem.title} aria-label="Item title" readonly />
      </label>

      <div class="property-list">
        {#each selectedItemProperties as property (property.label)}
          <div class="property-row">
            <span>{property.label}</span>
            <strong>{property.value}</strong>
          </div>
        {/each}
      </div>
    {:else}
      <p class="section-label">Item details</p>
      <h2>Details later</h2>
      <p class="empty-detail">
        The right panel stays presentational in this slice. It will become live when list items land.
      </p>
    {/if}
  </aside>
</section>
