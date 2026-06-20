<script lang="ts">
  import { dragHandle } from 'svelte-dnd-action';

  import ListIcon from '$lib/lists/components/ListIcon.svelte';
  import type { VisibleListItem } from '$lib/lists/presenter';

  let {
    item,
    valueSummary,
    completed,
    selected,
    onToggleComplete,
    onOpenDetail,
    onDelete
  }: {
    item: VisibleListItem;
    valueSummary: string;
    completed: boolean;
    selected: boolean;
    onToggleComplete: () => void;
    onOpenDetail: () => void;
    onDelete: () => void;
  } = $props();
</script>

<div
  role="button"
  tabindex="0"
  class={`group flex items-center gap-2 rounded-xl px-1 py-2 transition-colors cursor-pointer ${
    selected ? 'bg-warm-section-spend/50' : 'hover:bg-warm-bg-card'
  }`}
  onclick={onOpenDetail}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(); } }}
>
  {#if completed}
    <span class="invisible flex h-7 w-6 shrink-0 items-center justify-center" aria-hidden="true">
      <ListIcon name="grip" size={16} />
    </span>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      use:dragHandle
      class="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center text-warm-text-tertiary active:cursor-grabbing"
      aria-label={`Drag to reorder ${item.title}`}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <ListIcon name="grip" size={16} />
    </span>
  {/if}

  <button
    type="button"
    class={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
      completed ? 'border-warm-accent bg-warm-accent text-warm-text-on-dark' : 'border-warm-section-income text-transparent'
    }`}
    aria-label={completed ? `Mark ${item.title} active` : `Mark ${item.title} complete`}
    onclick={(e) => { e.stopPropagation(); onToggleComplete(); }}
  >
    <ListIcon name="check" size={12} />
  </button>

  <span
    class={`min-w-0 flex-1 truncate text-left text-sm ${
      completed ? 'text-warm-text-secondary line-through' : 'font-semibold text-warm-text-primary'
    }`}
  >
    {item.title}
  </span>

  {#if valueSummary}
    <span class="hidden shrink-0 truncate text-xs text-warm-text-secondary min-[700px]:inline">
      {valueSummary}
    </span>
  {/if}

  <button
    type="button"
    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-warm-accent opacity-0 transition-opacity hover:bg-warm-section-spend group-hover:opacity-100"
    aria-label={`Delete ${item.title}`}
    onclick={(e) => { e.stopPropagation(); onDelete(); }}
  >
    <ListIcon name="trash" size={15} />
  </button>
</div>
