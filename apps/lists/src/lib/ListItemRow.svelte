<script lang="ts">
  import type { VisibleListItem } from '$lib/lists-presenter';
  import ListIcon from '$lib/ListIcon.svelte';

  let {
    item,
    valueSummary,
    completed,
    selected,
    onToggleComplete,
    onOpenDetail,
    onDelete,
    dragDisabled,
    onHandlePointerDown
  }: {
    item: VisibleListItem;
    valueSummary: string;
    completed: boolean;
    selected: boolean;
    onToggleComplete: () => void;
    onOpenDetail: () => void;
    onDelete: () => void;
    dragDisabled: boolean;
    onHandlePointerDown: () => void;
  } = $props();
</script>

<div
  class={`group flex items-center gap-2 rounded-xl px-2 py-2 transition-colors ${
    selected ? 'bg-warm-section-spend/50' : 'hover:bg-warm-bg-card'
  }`}
>
  <button
    type="button"
    class={`flex h-7 w-6 shrink-0 items-center justify-center text-warm-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 ${
      completed ? 'invisible' : 'cursor-grab active:cursor-grabbing'
    }`}
    aria-label={`Drag to reorder ${item.title}`}
    disabled={completed}
    onpointerdown={() => {
      if (dragDisabled && !completed) onHandlePointerDown();
    }}
  >
    <ListIcon name="grip" size={16} />
  </button>

  <button
    type="button"
    class={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
      completed ? 'border-warm-accent bg-warm-accent text-warm-text-on-dark' : 'border-warm-section-income text-transparent'
    }`}
    aria-label={completed ? `Mark ${item.title} active` : `Mark ${item.title} complete`}
    onclick={onToggleComplete}
  >
    <ListIcon name="check" size={12} />
  </button>

  <button
    type="button"
    class={`min-w-0 flex-1 truncate text-left text-sm ${
      completed ? 'text-warm-text-secondary line-through' : 'font-semibold text-warm-text-primary'
    }`}
    onclick={onOpenDetail}
  >
    {item.title}
  </button>

  {#if valueSummary}
    <span class="hidden shrink-0 truncate text-xs text-warm-text-secondary min-[700px]:inline">
      {valueSummary}
    </span>
  {/if}

  <button
    type="button"
    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-warm-accent opacity-0 transition-opacity hover:bg-warm-section-spend group-hover:opacity-100"
    aria-label={`Delete ${item.title}`}
    onclick={onDelete}
  >
    <ListIcon name="trash" size={15} />
  </button>

  <button
    type="button"
    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-warm-text-tertiary hover:text-warm-text-primary"
    aria-label={`Open details for ${item.title}`}
    onclick={onOpenDetail}
  >
    <ListIcon name="open-panel" size={16} />
  </button>
</div>
