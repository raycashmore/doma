<script lang="ts">
  import { type DndEvent, dragHandle, dragHandleZone } from 'svelte-dnd-action';

  import ListIcon from '$lib/ListIcon.svelte';
  import type { VisibleListProperty } from '$lib/lists-presenter';

  let {
    properties,
    error,
    onClose,
    onReorder,
    propertyRenameId,
    propertyRenameName,
    setPropertyRenameName,
    beginRename,
    cancelRename,
    onSaveRename,
    pendingRemoveId,
    requestRemove,
    cancelRemove,
    onConfirmRemove,
    draftName,
    setDraftName,
    draftType,
    setDraftType,
    draftOptions,
    setDraftOptions,
    onCreate,
    propertyTypeLabel
  }: {
    properties: VisibleListProperty[];
    error: string | null;
    onClose: () => void;
    onReorder: (propertyId: string, targetIndex: number) => Promise<boolean>;
    propertyRenameId: string | null;
    propertyRenameName: string;
    setPropertyRenameName: (value: string) => void;
    beginRename: (property: VisibleListProperty) => void;
    cancelRename: () => void;
    onSaveRename: () => void;
    pendingRemoveId: string | null;
    requestRemove: (propertyId: string) => void;
    cancelRemove: () => void;
    onConfirmRemove: () => void;
    draftName: string;
    setDraftName: (v: string) => void;
    draftType: VisibleListProperty['type'];
    setDraftType: (v: VisibleListProperty['type']) => void;
    draftOptions: string;
    setDraftOptions: (v: string) => void;
    onCreate: () => void;
    propertyTypeLabel: (t: VisibleListProperty['type']) => string;
  } = $props();

  // Local $state for the dnd list, seeded from the `properties` prop and frozen
  // mid-drag or while a reorder is waiting for the query to confirm it.
  let dndItems = $state<{ id: string; property: VisibleListProperty }[]>([]);
  let isDragging = $state(false);
  let pendingOrder = $state<string[] | null>(null);

  $effect(() => {
    const next = properties.map((property) => ({ id: property._id, property }));
    if (isDragging) return;
    if (pendingOrder) {
      const sourceOrder = next.map((entry) => entry.id);
      if (sourceOrder.join('\0') !== pendingOrder.join('\0')) return;
      pendingOrder = null;
    }
    dndItems = next;
  });

  function handleConsider(event: CustomEvent<DndEvent<{ id: string; property: VisibleListProperty }>>) {
    isDragging = true;
    dndItems = event.detail.items;
  }

  async function handleFinalize(event: CustomEvent<DndEvent<{ id: string; property: VisibleListProperty }>>) {
    dndItems = event.detail.items;
    const order = event.detail.items.map((entry) => entry.id);
    const movedId = event.detail.info.id;
    const targetIndex = order.indexOf(movedId);
    pendingOrder = targetIndex >= 0 ? order : null;
    isDragging = false;
    if (targetIndex < 0) return;

    const succeeded = await onReorder(movedId, targetIndex);
    if (!succeeded) pendingOrder = null;
  }
</script>

<div class="flex h-full flex-col gap-4">
  <div class="flex items-center justify-between">
    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-warm-text-secondary">List settings</p>
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-full bg-warm-bg-dark text-warm-text-on-dark"
      aria-label="Close settings"
      onclick={onClose}
    >
      <ListIcon name="close" size={16} />
    </button>
  </div>

  {#if error}
    <p class="text-sm text-warm-accent">{error}</p>
  {/if}

  {#if dndItems.length}
    <ul
      class="flex flex-col gap-2"
      use:dragHandleZone={{ items: dndItems, flipDurationMs: 160, dropTargetStyle: {} }}
      onconsider={handleConsider}
      onfinalize={handleFinalize}
    >
      {#each dndItems as entry (entry.id)}
        <li class="rounded-2xl border border-warm-border bg-warm-bg-card p-3">
          {#if propertyRenameId === entry.property._id}
            <form
              class="flex flex-col gap-2"
              onsubmit={(event) => {
                event.preventDefault();
                onSaveRename();
              }}
            >
              <input
                class="rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
                value={propertyRenameName}
                oninput={(event) => setPropertyRenameName(event.currentTarget.value)}
                placeholder="Property name"
              />
              <div class="flex gap-2">
                <button type="button" class="flex-1 rounded-full border border-warm-border px-3 py-2 text-xs font-medium text-warm-text-secondary" onclick={cancelRename}>Cancel</button>
                <button type="submit" class="flex-1 rounded-full bg-warm-text-primary px-3 py-2 text-xs font-bold text-warm-text-on-dark disabled:opacity-60" disabled={!propertyRenameName.trim()}>Save</button>
              </div>
            </form>
          {:else}
            <div class="flex items-center gap-2">
              <span
                use:dragHandle
                class="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center text-warm-text-tertiary active:cursor-grabbing"
                aria-label={`Drag to reorder ${entry.property.name}`}
              >
                <ListIcon name="grip" size={16} />
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-warm-text-primary">{entry.property.name}</p>
                <p class="text-[11px] uppercase tracking-[0.16em] text-warm-text-secondary">{propertyTypeLabel(entry.property.type)}</p>
              </div>
              <button type="button" class="rounded-full border border-warm-border px-3 py-1.5 text-[11px] font-semibold text-warm-text-secondary" onclick={() => beginRename(entry.property)}>Rename</button>
              <button type="button" class="flex h-7 w-7 items-center justify-center rounded-full text-warm-accent hover:bg-warm-section-spend" aria-label={`Remove ${entry.property.name}`} onclick={() => requestRemove(entry.property._id)}>
                <ListIcon name="trash" size={15} />
              </button>
            </div>

            {#if pendingRemoveId === entry.property._id}
              <div class="mt-3 rounded-xl border border-warm-border bg-warm-bg px-3 py-3">
                <p class="text-sm text-warm-text-secondary">Removing this property clears its values from every item.</p>
                <div class="mt-2 flex gap-2">
                  <button type="button" class="flex-1 rounded-full border border-warm-border px-3 py-2 text-xs font-medium text-warm-text-secondary" onclick={cancelRemove}>Cancel</button>
                  <button type="button" class="flex-1 rounded-full bg-warm-accent px-3 py-2 text-xs font-bold text-warm-text-on-dark" onclick={onConfirmRemove}>Confirm remove</button>
                </div>
              </div>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <div class="rounded-2xl border border-dashed border-warm-border bg-warm-bg-card px-4 py-5 text-sm text-warm-text-secondary">
      No properties yet. Add one to shape what details each item can hold.
    </div>
  {/if}

  <form
    class="mt-2 flex flex-col gap-2 rounded-[20px] border border-warm-border bg-warm-bg-card p-4"
    onsubmit={(event) => {
      event.preventDefault();
      onCreate();
    }}
  >
    <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-warm-text-secondary">Add property</p>
    <input
      class="rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
      value={draftName}
      oninput={(event) => setDraftName(event.currentTarget.value)}
      placeholder="Priority"
    />
    <select
      class="rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
      value={draftType}
      onchange={(event) => setDraftType(event.currentTarget.value as VisibleListProperty['type'])}
    >
      <option value="text">Text</option>
      <option value="number">Number</option>
      <option value="date">Date</option>
      <option value="select">Select</option>
      <option value="checkbox">Checkbox</option>
    </select>
    {#if draftType === 'select'}
      <input
        class="rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
        value={draftOptions}
        oninput={(event) => setDraftOptions(event.currentTarget.value)}
        placeholder="High, Medium, Low"
      />
    {/if}
    <button
      type="submit"
      class="rounded-full bg-warm-text-primary px-4 py-2 text-sm font-bold text-warm-text-on-dark disabled:opacity-60"
      disabled={!draftName.trim() || (draftType === 'select' && !draftOptions.trim())}
    >
      Add property
    </button>
  </form>
</div>
