<script lang="ts">
  import { untrack } from 'svelte';

  import ListIcon from '$lib/ListIcon.svelte';
  import type {
    VisibleListItem,
    VisibleListItemPropertyValue,
    VisibleListProperty
  } from '$lib/lists-presenter';

  let {
    item,
    properties,
    completed,
    error,
    onClose,
    onRename,
    onSaveNotes,
    onToggleComplete,
    onDelete,
    valueEditorPropertyId,
    openValueEditor,
    resetValueEditor,
    onSaveValue,
    onClearValue,
    valueDraftText,
    valueDraftNumber,
    valueDraftDate,
    valueDraftSelectOptionId,
    valueDraftCheckbox,
    setValueDraftText,
    setValueDraftNumber,
    setValueDraftDate,
    setValueDraftSelectOptionId,
    setValueDraftCheckbox,
    describePropertyValue,
    findPropertyValue
  }: {
    item: VisibleListItem;
    properties: VisibleListProperty[];
    completed: boolean;
    error: string | null;
    onClose: () => void;
    onRename: (title: string) => void;
    onSaveNotes: (notes: string) => void;
    onToggleComplete: () => void;
    onDelete: () => void;
    valueEditorPropertyId: string | null;
    openValueEditor: (property: VisibleListProperty, value: VisibleListItemPropertyValue | null) => void;
    resetValueEditor: () => void;
    onSaveValue: (property: VisibleListProperty) => void;
    onClearValue: (propertyId: string) => void;
    valueDraftText: string;
    valueDraftNumber: string;
    valueDraftDate: string;
    valueDraftSelectOptionId: string;
    valueDraftCheckbox: boolean;
    setValueDraftText: (value: string) => void;
    setValueDraftNumber: (value: string) => void;
    setValueDraftDate: (value: string) => void;
    setValueDraftSelectOptionId: (value: string) => void;
    setValueDraftCheckbox: (value: boolean) => void;
    describePropertyValue: (p: VisibleListProperty, v: VisibleListItemPropertyValue) => string;
    findPropertyValue: (item: VisibleListItem, propertyId: string) => VisibleListItemPropertyValue | null;
  } = $props();

  // Seed local editable drafts from the item prop once; the $effect below
  // re-seeds them whenever a different item is selected. untrack makes the
  // intentional read-once explicit (silences state_referenced_locally).
  let titleDraft = $state(untrack(() => item.title));
  let notesDraft = $state(untrack(() => item.notes ?? ''));
  let lastItemId = $state(untrack(() => item._id));

  $effect(() => {
    if (item._id === lastItemId) return;
    lastItemId = item._id;
    titleDraft = item.title;
    notesDraft = item.notes ?? '';
  });
</script>

<div class="flex h-full flex-col gap-4">
  <div class="flex items-center justify-between">
    <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-warm-text-secondary">Item details</p>
    <button
      type="button"
      class="flex h-8 w-8 items-center justify-center rounded-full text-warm-text-secondary hover:text-warm-text-primary"
      aria-label="Close details"
      onclick={onClose}
    >
      <ListIcon name="close" size={16} />
    </button>
  </div>

  <div class="rounded-[18px] bg-warm-section-spend p-4">
    <input
      class="w-full bg-transparent font-warm-display text-[26px] leading-tight text-warm-text-primary outline-none"
      value={titleDraft}
      oninput={(event) => (titleDraft = event.currentTarget.value)}
      onblur={() => {
        const next = titleDraft.trim();
        if (next && next !== item.title) onRename(next);
        else titleDraft = item.title;
      }}
      aria-label="Item title"
    />
    <p class="mt-1 text-xs text-warm-text-secondary">{completed ? 'Completed' : 'Active'}</p>
  </div>

  {#if error}
    <p class="text-sm text-warm-accent">{error}</p>
  {/if}

  <div class="rounded-[16px] border border-warm-border bg-warm-bg-card p-4">
    <p class="text-[12px] font-bold text-warm-text-primary">Notes</p>
    <textarea
      class="mt-2 w-full resize-none bg-transparent text-sm leading-relaxed text-warm-text-secondary outline-none"
      rows="3"
      placeholder="Add a note for this item"
      value={notesDraft}
      oninput={(event) => (notesDraft = event.currentTarget.value)}
      onblur={() => {
        if (notesDraft !== (item.notes ?? '')) onSaveNotes(notesDraft);
      }}
    ></textarea>
  </div>

  <div class="flex flex-col">
    {#each properties as property (property._id)}
      {@const currentValue = findPropertyValue(item, property._id)}
      <div class="border-b border-warm-border/60 py-3">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-warm-text-secondary">{property.name}</p>
          {#if valueEditorPropertyId !== property._id}
            <button
              type="button"
              class="truncate text-sm font-semibold text-warm-text-primary"
              onclick={() => openValueEditor(property, currentValue)}
            >
              {currentValue ? describePropertyValue(property, currentValue) : 'Add'}
            </button>
          {/if}
        </div>

        {#if valueEditorPropertyId === property._id}
          <div class="mt-3 flex flex-col gap-2">
            {#if property.type === 'text'}
              <input
                class="rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
                value={valueDraftText}
                oninput={(event) => setValueDraftText(event.currentTarget.value)}
                placeholder={`Add ${property.name.toLowerCase()}`}
              />
            {:else if property.type === 'number'}
              <input
                type="number"
                class="rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
                value={valueDraftNumber}
                oninput={(event) => setValueDraftNumber(event.currentTarget.value)}
                placeholder="0"
              />
            {:else if property.type === 'date'}
              <input
                type="date"
                class="rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
                value={valueDraftDate}
                oninput={(event) => setValueDraftDate(event.currentTarget.value)}
              />
            {:else if property.type === 'select'}
              <select
                class="rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary outline-none"
                value={valueDraftSelectOptionId}
                onchange={(event) => setValueDraftSelectOptionId(event.currentTarget.value)}
              >
                {#each property.options ?? [] as option (option.id)}
                  <option value={option.id}>{option.label}</option>
                {/each}
              </select>
            {:else}
              <label class="flex items-center justify-between rounded-xl border border-warm-border bg-warm-bg px-3 py-2 text-sm text-warm-text-primary">
                <span>Checked</span>
                <input
                  type="checkbox"
                  class="h-4 w-4"
                  checked={valueDraftCheckbox}
                  onchange={(event) => setValueDraftCheckbox(event.currentTarget.checked)}
                />
              </label>
            {/if}
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-full border border-warm-border px-3 py-2 text-xs font-medium text-warm-text-secondary"
                onclick={resetValueEditor}
              >
                Cancel
              </button>
              {#if currentValue}
                <button
                  type="button"
                  class="rounded-full border border-warm-border px-3 py-2 text-xs font-semibold text-warm-accent"
                  onclick={() => onClearValue(property._id)}
                >
                  Clear
                </button>
              {/if}
              <button
                type="button"
                class="flex-1 rounded-full bg-warm-text-primary px-3 py-2 text-xs font-bold text-warm-text-on-dark disabled:opacity-60"
                disabled={
                  (property.type === 'text' && !valueDraftText.trim()) ||
                  (property.type === 'number' && valueDraftNumber === '') ||
                  (property.type === 'date' && !valueDraftDate) ||
                  (property.type === 'select' && !valueDraftSelectOptionId)
                }
                onclick={() => onSaveValue(property)}
              >
                Save
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="mt-auto flex flex-col gap-2">
    <button
      type="button"
      class="flex items-center justify-center gap-2 rounded-full bg-warm-text-primary px-4 py-3 text-sm font-bold text-warm-text-on-dark"
      onclick={onToggleComplete}
    >
      <ListIcon name="check" size={15} />
      {completed ? 'Reopen' : 'Complete'}
    </button>
    <button
      type="button"
      class="flex items-center justify-center gap-2 rounded-full border border-warm-border px-4 py-2 text-sm font-semibold text-warm-accent"
      onclick={onDelete}
    >
      <ListIcon name="trash" size={15} />
      Delete item
    </button>
  </div>
</div>
