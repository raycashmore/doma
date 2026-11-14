<script lang="ts">
  import { untrack } from 'svelte';
  import { type DndEvent, dragHandle, dragHandleZone } from 'svelte-dnd-action';

  import ListIcon from '$lib/lists/components/ListIcon.svelte';
  import type { PresentedList } from '$lib/lists/presenter';

  type Entry = { id: string; list: PresentedList };

  let {
    lists,
    emptyLabel,
    menuTargetPublicId = $bindable(),
    onOpen,
    onRename,
    onDelete,
    onReorder
  }: {
    /** The lists in the current tab, in the person's order. */
    lists: PresentedList[];
    emptyLabel: string;
    menuTargetPublicId: string | null;
    onOpen: (list: PresentedList) => void;
    onRename: (list: PresentedList) => void;
    onDelete: (list: PresentedList) => void;
    onReorder: (input: { publicId: string; targetIndex: number }) => Promise<void>;
  } = $props();

  // svelte-dnd-action needs its `items` replaced on every consider/finalize, so
  // the rows are local state. A dropped order stays on screen while any save is
  // in flight; Convex has applied each mutation to the query by the time it
  // resolves, so the live order takes over once the last save returns. A
  // different set of lists (another tab, or a list added or removed) shows at
  // once, except mid-drag, when the library's placeholder row is in `entries`.
  let entries = $state<Entry[]>([]);
  let isDragging = $state(false);
  let savesInFlight = $state(0);
  let saveFailed = $state(false);

  $effect(() => {
    // Read both flags on every run, so the effect also re-runs when a hold ends.
    const dragging = isDragging;
    const saving = savesInFlight > 0;
    const next = lists.map((list) => ({ id: list.publicId, list }));
    if (dragging) return;
    const shown = new Set(untrack(() => entries).map((entry) => entry.id));
    const sameLists = next.length === shown.size && next.every((entry) => shown.has(entry.id));
    if (!sameLists) saveFailed = false;
    if (sameLists && saving) return;
    entries = next;
  });

  function handleConsider(event: CustomEvent<DndEvent<Entry>>) {
    isDragging = true;
    entries = event.detail.items;
  }

  async function handleFinalize(event: CustomEvent<DndEvent<Entry>>) {
    entries = event.detail.items;
    isDragging = false;
    const publicId = event.detail.info.id;
    const targetIndex = entries.findIndex((entry) => entry.id === publicId);
    const unchanged = entries.every((entry, index) => entry.id === lists[index]?.publicId);
    if (targetIndex < 0 || unchanged) return;

    saveFailed = false;
    savesInFlight += 1;
    try {
      await onReorder({ publicId, targetIndex });
    } catch {
      // Releasing the hold puts the saved order back.
      saveFailed = true;
    } finally {
      savesInFlight -= 1;
    }
  }
</script>

{#if entries.length}
  <ul
    class="flex flex-col gap-2"
    aria-label="Lists"
    use:dragHandleZone={{ items: entries, flipDurationMs: 160, dropTargetStyle: {} }}
    onconsider={handleConsider}
    onfinalize={handleFinalize}
  >
    {#each entries as entry (entry.id)}
      {@const list = entry.list}
      {@const isMenuOpen = menuTargetPublicId === list.publicId}
      <li class={`relative w-full ${isMenuOpen ? 'z-30' : ''}`} data-list-menu-open={isMenuOpen ? 'true' : undefined}>
        <div
          class={`relative flex items-center rounded-2xl border transition-colors ${
            list.selected
              ? 'border-warm-accent bg-warm-section-spend'
              : 'border-warm-border bg-warm-bg-card hover:bg-warm-section-mortgage'
          }`}
        >
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            use:dragHandle
            class="ml-2 flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-warm-text-secondary active:cursor-grabbing"
            aria-label={`Drag to reorder ${list.name}`}
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
          >
            <ListIcon name="grip" size={16} />
          </span>
          <button
            type="button"
            aria-label={`Open ${list.name} list`}
            class="min-w-0 flex-1 rounded-2xl border-0 bg-transparent py-[14px] pl-2 pr-12 text-left"
            onclick={() => onOpen(list)}
          >
            <p
              class={`truncate text-sm ${list.selected ? 'font-bold text-warm-text-primary' : 'font-semibold text-warm-text-secondary'}`}
            >
              {list.name}
            </p>
            <p class="mt-1 text-[11px] text-warm-text-secondary">{list.description}</p>
          </button>
          <div class="absolute right-[14px] top-1/2 -translate-y-1/2">
            <button
              type="button"
              class="rounded-full border-0 bg-transparent px-2 py-1 text-sm text-warm-text-secondary hover:text-warm-text-primary"
              aria-label={`List actions for ${list.name}`}
              onclick={(e) => {
                e.stopPropagation();
                menuTargetPublicId = isMenuOpen ? null : list.publicId;
              }}
            >
              •••
            </button>
          </div>
          {#if isMenuOpen}
            <button
              type="button"
              aria-label="Close list actions menu"
              class="fixed inset-0 z-10 cursor-default border-0 bg-transparent p-0"
              onclick={(e) => {
                e.stopPropagation();
                menuTargetPublicId = null;
              }}
            ></button>
            <div
              class="absolute right-[14px] top-12 z-20 w-36 rounded-2xl border border-warm-border bg-warm-bg-card p-2 shadow-[0_20px_40px_rgba(61,46,34,0.16)]"
            >
              <button
                type="button"
                class="flex w-full rounded-xl px-3 py-2 text-left text-sm text-warm-text-primary hover:bg-warm-bg"
                onclick={(e) => {
                  e.stopPropagation();
                  onRename(list);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                class="flex w-full rounded-xl px-3 py-2 text-left text-sm text-warm-accent hover:bg-warm-bg"
                onclick={(e) => {
                  e.stopPropagation();
                  onDelete(list);
                }}
              >
                Delete
              </button>
            </div>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
{:else}
  <p class="text-sm text-warm-text-secondary">{emptyLabel}</p>
{/if}
{#if saveFailed}
  <p class="mt-2 text-sm text-warm-accent" role="alert">Unable to save the new list order.</p>
{/if}
