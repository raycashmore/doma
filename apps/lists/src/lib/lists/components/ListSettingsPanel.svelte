<script lang="ts">
  import { type DndEvent, dragHandle, dragHandleZone } from 'svelte-dnd-action';

  import ListIcon from '$lib/lists/components/ListIcon.svelte';
  import type { VisibleList, VisibleListProperty } from '$lib/lists/presenter';

  let {
    properties,
    error,
    onClose,
    onReorder,
    propertyRenameId,
    propertyRenameName,
    setPropertyRenameName,
    propertyRenameOptions,
    setPropertyRenameOptions,
    addPropertyRenameOption,
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
    propertyTypeLabel,
    onDeleteList,
    availableLists,
    currentDefaultPublicId,
    onSetDefaultList,
    onSetCategorisation,
    onClearCategorisation
  }: {
    properties: VisibleListProperty[];
    error: string | null;
    onClose: () => void;
    onReorder: (propertyId: string, targetIndex: number) => Promise<boolean>;
    propertyRenameId: string | null;
    propertyRenameName: string;
    setPropertyRenameName: (value: string) => void;
    propertyRenameOptions: NonNullable<VisibleListProperty['options']>;
    setPropertyRenameOptions: (options: NonNullable<VisibleListProperty['options']>) => void;
    addPropertyRenameOption: () => void;
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
    onDeleteList: () => void;
    /** The household user's personal and shared lists, used as picker options. */
    availableLists: VisibleList[];
    /** The publicId of the user's current default list, or null when none is set. */
    currentDefaultPublicId: string | null;
    /** Called with the chosen list's stable publicId when the default changes. */
    onSetDefaultList: (publicId: string) => void;
    onSetCategorisation: (input: { propertyId: string; instruction: string }) => void;
    onClearCategorisation: (propertyId: string) => void;
  } = $props();

  const personalLists = $derived(availableLists.filter((list) => list.visibility === 'personal'));
  const sharedLists = $derived(availableLists.filter((list) => list.visibility === 'shared'));

  // Local $state for the dnd list, seeded from the `properties` prop and frozen
  // mid-drag or while a reorder is waiting for the query to confirm it.
  let dndItems = $state<{ id: string; property: VisibleListProperty }[]>([]);
  let isDragging = $state(false);
  let pendingOrder = $state<string[] | null>(null);
  let categorisationPropertyId = $state('');
  let categorisationInstruction = $state('');
  let categorisationSnapshot = $state('');
  let showAddProperty = $state(false);

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

  const selectProperties = $derived(properties.filter((property) => property.type === 'select'));
  const configuredCategorisationPropertyId = $derived(
    selectProperties.find((property) => property.categorisationInstruction)?._id ?? ''
  );

  $effect(() => {
    const configured = selectProperties.find((property) => property._id === configuredCategorisationPropertyId);
    const snapshot = `${configured?._id ?? ''}\0${configured?.categorisationInstruction ?? ''}`;
    if (snapshot === categorisationSnapshot) return;
    categorisationSnapshot = snapshot;
    categorisationPropertyId = configured?._id ?? '';
    categorisationInstruction = configured?.categorisationInstruction ?? '';
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

<div class="flex h-full min-h-0 flex-col">
  <div class="flex shrink-0 items-center justify-between pb-4">
    <p class="text-base font-semibold text-warm-text-primary">List settings</p>
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-full bg-warm-bg-dark text-warm-text-on-dark"
      aria-label="Close settings"
      onclick={onClose}
    >
      <ListIcon name="close" size={16} />
    </button>
  </div>

  <div data-testid="list-settings-body" class="min-h-0 flex-1 overflow-y-auto pr-1">
    <div class="flex flex-col pb-2">
      {#if error}
        <p class="mb-5 border-l-2 border-warm-accent bg-warm-section-spend/50 px-3 py-2 text-sm text-warm-accent">
          {error}
        </p>
      {/if}

      <section class="border-b border-warm-border pb-5">
        <p class="text-sm font-semibold text-warm-text-primary">Default list</p>
        <p class="mt-1 text-xs leading-5 text-warm-text-secondary">
          When a Telegram message names no list, captures land on your default list.
        </p>
        {#if personalLists.length || sharedLists.length}
          <label class="mt-3 block">
            <span class="sr-only">Default list</span>
            <select
              class="w-full rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
              aria-label="Default list"
              data-testid="default-list-picker"
              value={currentDefaultPublicId ?? ''}
              onchange={(event) => {
                const next = event.currentTarget.value;
                if (next) onSetDefaultList(next);
              }}
            >
              <option value="" disabled>No default list</option>
              {#if personalLists.length}
                <optgroup label="Personal lists">
                  {#each personalLists as list (list.publicId)}
                    <option value={list.publicId}>{list.name}</option>
                  {/each}
                </optgroup>
              {/if}
              {#if sharedLists.length}
                <optgroup label="Shared lists">
                  {#each sharedLists as list (list.publicId)}
                    <option value={list.publicId}>{list.name}</option>
                  {/each}
                </optgroup>
              {/if}
            </select>
          </label>
        {:else}
          <p class="mt-2 text-xs text-warm-text-secondary">Create a list to choose a default.</p>
        {/if}
      </section>

      {#if selectProperties.length}
        <form
          class="border-b border-warm-border py-5"
          onsubmit={(event) => {
            event.preventDefault();
            if (categorisationPropertyId && categorisationInstruction.trim()) {
              onSetCategorisation({ propertyId: categorisationPropertyId, instruction: categorisationInstruction });
            }
          }}
        >
          <p class="text-sm font-semibold text-warm-text-primary">AI categorisation</p>
          <p class="mt-1 text-xs leading-5 text-warm-text-secondary">
            Choose one select property and tell AI how to use its existing options.
          </p>
          <select
            class="mt-3 w-full rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
            aria-label="AI categorisation property"
            bind:value={categorisationPropertyId}
          >
            <option value="" disabled>Select property</option>
            {#each selectProperties as property (property._id)}
              <option value={property._id}>{property.name}</option>
            {/each}
          </select>
          <input
            class="mt-2 w-full rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
            aria-label="AI categorisation instruction"
            bind:value={categorisationInstruction}
            maxlength="500"
            placeholder="Place groceries into the correct store section"
          />
          <button
            type="submit"
            class="mt-2 w-full rounded-full bg-warm-text-primary px-4 py-2 text-sm font-bold text-warm-text-on-dark disabled:opacity-60"
            disabled={!categorisationPropertyId || !categorisationInstruction.trim()}
          >
            Save AI categorisation
          </button>
          {#if configuredCategorisationPropertyId}
            <button
              type="button"
              class="mt-2 w-full rounded-full border border-warm-border px-4 py-2 text-sm font-semibold text-warm-text-secondary"
              onclick={() => onClearCategorisation(configuredCategorisationPropertyId)}
            >
              Turn off AI categorisation
            </button>
          {/if}
        </form>
      {/if}

      {#if dndItems.length}
        <section class="border-b border-warm-border py-5">
          <div class="mb-1 flex items-baseline justify-between">
            <p class="text-sm font-semibold text-warm-text-primary">Properties</p>
            <div class="flex items-center">
              {#if !showAddProperty}
                <button
                  type="button"
                  class="text-xs font-semibold text-warm-accent hover:text-warm-text-primary"
                  onclick={() => (showAddProperty = true)}
                >
                  Add property
                </button>
              {/if}
            </div>
          </div>
          <ul
            class="divide-y divide-warm-border border-y border-warm-border"
            use:dragHandleZone={{ items: dndItems, flipDurationMs: 160, dropTargetStyle: {} }}
            onconsider={handleConsider}
            onfinalize={handleFinalize}
          >
            {#each dndItems as entry (entry.id)}
              <li class="py-3">
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
                    {#if entry.property.type === 'select'}
                      <fieldset class="mt-1 flex flex-col gap-2 border-l-2 border-warm-border pl-3">
                        <legend class="px-1 text-xs font-semibold text-warm-text-secondary">Options</legend>
                        {#each propertyRenameOptions as option (option.id)}
                          <div class="flex items-center gap-2">
                            <input
                              class="min-w-0 flex-1 rounded-lg border border-warm-border bg-warm-bg-card px-3 py-2 text-sm text-warm-text-primary outline-none"
                              aria-label={`Option ${option.label || 'new option'}`}
                              value={option.label}
                              oninput={(event) =>
                                setPropertyRenameOptions(
                                  propertyRenameOptions.map((candidate) =>
                                    candidate.id === option.id
                                      ? { ...candidate, label: event.currentTarget.value }
                                      : candidate
                                  )
                                )}
                            />
                            <button
                              type="button"
                              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-warm-accent hover:bg-warm-section-spend disabled:opacity-40"
                              aria-label={`Remove ${option.label || 'option'}`}
                              disabled={propertyRenameOptions.length === 1}
                              onclick={() =>
                                setPropertyRenameOptions(
                                  propertyRenameOptions.filter((candidate) => candidate.id !== option.id)
                                )}
                            >
                              <ListIcon name="trash" size={14} />
                            </button>
                          </div>
                        {/each}
                        <p class="text-xs leading-5 text-warm-text-secondary">
                          Removing an option clears it from any assigned items.
                        </p>
                        <button
                          type="button"
                          class="self-start rounded-full border border-warm-border px-3 py-1.5 text-xs font-medium text-warm-text-secondary hover:bg-warm-bg-card"
                          onclick={addPropertyRenameOption}
                        >
                          Add option
                        </button>
                      </fieldset>
                    {/if}
                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="flex-1 rounded-full border border-warm-border px-3 py-2 text-xs font-medium text-warm-text-secondary"
                        onclick={cancelRename}>Cancel</button
                      >
                      <button
                        type="submit"
                        class="flex-1 rounded-full bg-warm-text-primary px-3 py-2 text-xs font-bold text-warm-text-on-dark disabled:opacity-60"
                        disabled={!propertyRenameName.trim() ||
                          (entry.property.type === 'select' &&
                            (!propertyRenameOptions.length ||
                              propertyRenameOptions.some((option) => !option.label.trim())))}>Save</button
                      >
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
                      <p class="text-xs text-warm-text-secondary">
                        {propertyTypeLabel(entry.property.type)}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-full border border-warm-border text-warm-text-secondary hover:bg-warm-bg hover:text-warm-text-primary"
                      aria-label={`Rename ${entry.property.name}`}
                      title={`Rename ${entry.property.name}`}
                      onclick={() => beginRename(entry.property)}
                    >
                      <ListIcon name="edit" size={15} />
                    </button>
                    <button
                      type="button"
                      class="flex h-7 w-7 items-center justify-center rounded-full text-warm-accent hover:bg-warm-section-spend"
                      aria-label={`Remove ${entry.property.name}`}
                      onclick={() => requestRemove(entry.property._id)}
                    >
                      <ListIcon name="trash" size={15} />
                    </button>
                  </div>

                  {#if pendingRemoveId === entry.property._id}
                    <div class="mt-3 rounded-xl border border-warm-border bg-warm-bg px-3 py-3">
                      <p class="text-sm text-warm-text-secondary">
                        Removing this property clears its values from every item.
                      </p>
                      <div class="mt-2 flex gap-2">
                        <button
                          type="button"
                          class="flex-1 rounded-full border border-warm-border px-3 py-2 text-xs font-medium text-warm-text-secondary"
                          onclick={cancelRemove}>Cancel</button
                        >
                        <button
                          type="button"
                          class="flex-1 rounded-full bg-warm-accent px-3 py-2 text-xs font-bold text-warm-text-on-dark"
                          onclick={onConfirmRemove}>Confirm remove</button
                        >
                      </div>
                    </div>
                  {/if}
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {:else}
        <div class="border-b border-warm-border py-5">
          <p class="text-sm text-warm-text-secondary">
            No properties yet. Add one to shape what details each item can hold.
          </p>
          {#if !showAddProperty}
            <button
              type="button"
              class="mt-3 text-sm font-semibold text-warm-accent hover:text-warm-text-primary"
              onclick={() => (showAddProperty = true)}
            >
              Add property
            </button>
          {/if}
        </div>
      {/if}

      {#if showAddProperty}
        <form
          class="flex flex-col gap-2 border-b border-warm-border py-5"
          onsubmit={(event) => {
            event.preventDefault();
            onCreate();
          }}
        >
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-warm-text-primary">Add property</p>
            <button
              type="button"
              class="text-xs font-medium text-warm-text-secondary hover:text-warm-text-primary"
              onclick={() => (showAddProperty = false)}
            >
              Cancel
            </button>
          </div>
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
      {/if}

      <div class="pt-5">
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-full border border-warm-accent px-4 py-2 text-sm font-semibold text-warm-accent hover:bg-warm-section-spend"
          onclick={onDeleteList}
        >
          <ListIcon name="trash" size={15} />
          Delete list
        </button>
      </div>
    </div>
  </div>
</div>
