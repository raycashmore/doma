<script lang="ts">
  import { slugifyListName } from '@repo/convex/lists/model';
  import { cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import { type DndEvent, dragHandleZone } from 'svelte-dnd-action';

  import { browser, dev } from '$app/environment';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import ItemDetailPanel from '$lib/lists/components/ItemDetailPanel.svelte';
  import ListIcon from '$lib/lists/components/ListIcon.svelte';
  import ListItemRow from '$lib/lists/components/ListItemRow.svelte';
  import ListSettingsPanel from '$lib/lists/components/ListSettingsPanel.svelte';
  import { parsePastedItems,type PasteEntry } from '$lib/lists/paste-parser';
  import {
    getSelectedItem,
    type PresentedList,
    presentLists,
    previewItemsByListPublicId,
    previewVisibleLists,
    type VisibleListItem,
    type VisibleListItemPropertyValue,
    type VisibleListProperty
  } from '$lib/lists/presenter';
  import {
    buildListHref,
    buildListsHomeHref,
    readLastListPublicId,
    writeLastListPublicId
  } from '$lib/lists/routing';
  import { type ListItemPropertyValueInput,ListStoreFacade } from '$lib/lists/store.svelte';

  const USE_DEV_FIXTURE = dev && !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  // How long an authed dev session waits on an unresponsive Convex backend before
  // dropping to fixtures. Generous on purpose: the fallback is reversible, so this
  // only needs to outlast a normal cold connect, not race it.
  const OFFLINE_FALLBACK_MS = 4000;

  let {
    selectedPublicId = null
  }: {
    selectedPublicId?: string | null;
  } = $props();

  let createName = $state('');
  let createVisibility = $state<'personal' | 'shared'>('personal');
  let renameName = $state('');
  let renameSeededFor = $state<string | null>(null);
  let mutationError = $state<string | null>(null);
  let itemDraft = $state('');
  let itemMutationError = $state<string | null>(null);
  let pastePreview = $state<PasteEntry[] | null>(null);
  let pasteSubmitting = $state(false);
  let pastePreviewError = $state<string | null>(null);
  let pasteDialog = $state<HTMLDialogElement>();
  let listDialog = $state<HTMLDialogElement>();
  const pastePreviewItemCount = $derived(
    pastePreview ? pastePreview.filter((entry) => entry.kind === 'item').length : 0
  );
  let listFilter = $state<'personal' | 'shared'>('personal');
  let menuTargetPublicId = $state<string | null>(null);
  let renameTargetPublicId = $state<string | null>(null);
  let deleteTargetPublicId = $state<string | null>(null);
  let showCreateDialog = $state(false);
  const listDialogOpen = $derived(
    showCreateDialog || renameTargetPublicId !== null || deleteTargetPublicId !== null
  );
  let selectedItemId = $state<string | null>(null);
  let rightPanel = $state<'closed' | 'item' | 'settings'>('closed');
  let showMobileDetails = $state(false);
  let showListSwitcher = $state(false);
  // Reversible offline fallback for an authed dev session whose Convex backend never
  // responds (e.g. `npx convex dev` not running). It clears the instant real data or a
  // real error arrives, so a merely-slow backend can't silently strand a live session
  // in non-persisting fixture mode. The explicit `dev:no-auth` mode stays sticky via
  // USE_DEV_FIXTURE below.
  let autoOfflineFallback = $state(false);
  const usePreviewData = $derived(USE_DEV_FIXTURE || autoOfflineFallback);

  // One seam over both backends: the live Convex adapter and an in-memory
  // adapter (dev fixture / offline fallback), selected by `usePreviewData`. The
  // screen reads `store.lists` / `store.selected` and calls command methods,
  // never branching on which backend answers.
  const store = new ListStoreFacade({
    useDevFixture: USE_DEV_FIXTURE,
    getUsePreview: () => usePreviewData,
    getSelectedPublicId: () => selectedPublicId,
    seedLists: previewVisibleLists,
    seedItemsByListPublicId: previewItemsByListPublicId
  });

  let propertyMutationError = $state<string | null>(null);
  let propertyDraftName = $state('');
  let propertyDraftType = $state<VisibleListProperty['type']>('text');
  let propertyDraftOptions = $state('');
  let propertyRenameId = $state<string | null>(null);
  let propertyRenameName = $state('');
  let pendingRemovePropertyId = $state<string | null>(null);
  let valueEditorPropertyId = $state<string | null>(null);
  let valueDraftText = $state('');
  let valueDraftNumber = $state('');
  let valueDraftDate = $state('');
  let valueDraftSelectOptionId = $state('');
  let valueDraftCheckbox = $state(false);
  let previousListPublicId = $state<string | null>(null);

  function describeError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : null;
    if (!message) return fallback;
    if (message.includes('Not authenticated')) return 'Sign in to load and edit household lists.';
    if (message.includes('List unavailable')) return 'This list may have been deleted or is no longer visible to you.';
    if (message.includes('List item unavailable')) return 'This item is unavailable.';
    return message;
  }

  function propertyTypeLabel(type: VisibleListProperty['type']) {
    switch (type) {
      case 'text':
        return 'Text';
      case 'number':
        return 'Number';
      case 'date':
        return 'Date';
      case 'select':
        return 'Select';
      case 'checkbox':
        return 'Checkbox';
    }
  }

  function slugifyOptionId(label: string, index: number) {
    return slugifyListName(label).replace(/-/g, '_') || `option_${index + 1}`;
  }

  function parsePropertyOptions(input: string) {
    const labels = input
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    return labels.map((label, index) => ({
      id: slugifyOptionId(label, index),
      label
    }));
  }

  function findPropertyValue(item: VisibleListItem | null, propertyId: string) {
    return item?.propertyValues.find((value) => value.listPropertyId === propertyId) ?? null;
  }

  function formatDateForInput(value?: number) {
    if (!value) return '';
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseDateInput(value: string) {
    if (!value) return null;
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.valueOf()) ? null : parsed.valueOf();
  }

  function describePropertyValue(property: VisibleListProperty, value: VisibleListItemPropertyValue) {
    switch (property.type) {
      case 'text':
        return value.textValue ?? '';
      case 'number':
        return value.numberValue === undefined ? '' : `${value.numberValue}`;
      case 'date':
        return value.dateValue ? new Date(value.dateValue).toLocaleDateString() : '';
      case 'checkbox':
        return value.checkboxValue ? 'Checked' : 'Unchecked';
      case 'select':
        return property.options?.find((option) => option.id === value.selectOptionId)?.label ?? '';
    }
  }

  function closeMobileDetails() {
    showMobileDetails = false;
    selectedItemId = null;
    rightPanel = 'closed';
    propertyRenameId = null;
    propertyRenameName = '';
    pendingRemovePropertyId = null;
    resetValueEditor();
  }

  function clearSelectedItem() {
    selectedItemId = null;
    rightPanel = 'closed';
  }

  function openItemDetails(itemId: string) {
    selectedItemId = itemId;
    rightPanel = 'item';
    showMobileDetails = true;
    propertyMutationError = null;
  }

  function resetValueEditor() {
    valueEditorPropertyId = null;
    valueDraftText = '';
    valueDraftNumber = '';
    valueDraftDate = '';
    valueDraftSelectOptionId = '';
    valueDraftCheckbox = false;
  }

  function beginPropertyRename(property: VisibleListProperty) {
    propertyRenameId = property._id;
    propertyRenameName = property.name;
    pendingRemovePropertyId = null;
    propertyMutationError = null;
  }

  function cancelPropertyRename() {
    propertyRenameId = null;
    propertyRenameName = '';
  }

  function openValueEditor(
    property: VisibleListProperty,
    currentValue: VisibleListItemPropertyValue | null = findPropertyValue(selectedItem, property._id)
  ) {
    valueEditorPropertyId = property._id;
    valueDraftText = currentValue?.textValue ?? '';
    valueDraftNumber = currentValue?.numberValue === undefined ? '' : `${currentValue.numberValue}`;
    valueDraftDate = formatDateForInput(currentValue?.dateValue);
    valueDraftSelectOptionId = currentValue?.selectOptionId ?? property.options?.[0]?.id ?? '';
    valueDraftCheckbox = currentValue?.checkboxValue ?? false;
    propertyMutationError = null;
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

    try {
      const created = await store.createList({ name: createName, visibility: createVisibility });
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

    try {
      const renamed = await store.renameList({ publicId: renameTargetPublicId, name: renameName });
      renameTargetPublicId = null;
      menuTargetPublicId = null;
      await goto(buildListHref(base, renamed), { replaceState: true, noScroll: true, keepFocus: true });
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

    try {
      await store.deleteList({ publicId: deleteTargetPublicId });
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

    try {
      await store.createItem({ listPublicId: selectedRow.publicId, title: itemDraft });
      itemDraft = '';
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to add item.');
    }
  }

  // Intercept a paste so newlines survive the single-line input: if the clipboard
  // parses into more than one item, hold them for confirmation instead of typing.
  function handleItemPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    const parsed = parsePastedItems(text);
    if (parsed.items.length < 2) return;

    event.preventDefault();
    pasteSubmitting = false;
    pastePreviewError = null;
    pastePreview = parsed.entries;
  }

  // Drive native <dialog> elements from state so we inherit focus trapping,
  // Escape handling, focus restoration, and an inert background for free.
  function syncDialog(dialog: HTMLDialogElement | undefined, open: boolean) {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    else if (!open && dialog.open) dialog.close?.();
  }

  $effect(() => syncDialog(pasteDialog, pastePreview !== null));
  $effect(() => syncDialog(listDialog, listDialogOpen));

  function resetListDialog() {
    showCreateDialog = false;
    renameTargetPublicId = null;
    deleteTargetPublicId = null;
    menuTargetPublicId = null;
    mutationError = null;
  }

  function resetPastePreview() {
    pastePreview = null;
    pasteSubmitting = false;
    pastePreviewError = null;
  }

  function removePastePreviewItem(index: number) {
    if (!pastePreview) return;
    pastePreview = pastePreview.filter((_, current) => current !== index);
  }

  async function confirmPastePreview() {
    if (!selectedRow?.publicId || !pastePreview || pasteSubmitting) return;
    const titles = pastePreview.filter((entry) => entry.kind === 'item').map((entry) => entry.text);
    if (titles.length === 0) {
      pasteDialog?.close();
      return;
    }

    pasteSubmitting = true;
    pastePreviewError = null;

    try {
      await store.createItems({ listPublicId: selectedRow.publicId, titles });
      pasteDialog?.close();
    } catch (error) {
      pastePreviewError = describeError(error, 'Unable to add items.');
      pasteSubmitting = false;
    }
  }

  async function removeItem(itemId: string) {
    itemMutationError = null;

    try {
      await store.deleteItem({ itemId });
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to delete item.');
    }
  }

  async function handleRenameSelectedItem(title: string) {
    if (!selectedItem) return;
    itemMutationError = null;
    try {
      await store.renameItem({ itemId: selectedItem._id, title });
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to rename item.');
    }
  }

  async function handleSaveSelectedNotes(notes: string) {
    if (!selectedItem) return;
    itemMutationError = null;
    try {
      await store.setItemNotes({ itemId: selectedItem._id, notes });
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to save notes.');
    }
  }

  async function toggleItemCompletion(item: VisibleListItem) {
    itemMutationError = null;

    try {
      if (item.completedAt === undefined) await store.completeItem({ itemId: item._id });
      else await store.uncompleteItem({ itemId: item._id });
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to update item.');
    }
  }

  async function handleClearCompletedItems() {
    if (!selectedRow?.publicId) return;
    itemMutationError = null;

    try {
      await store.clearCompleted({ listPublicId: selectedRow.publicId });
    } catch (error) {
      itemMutationError = describeError(error, 'Unable to clear completed items.');
    }
  }

  async function handleCreateProperty() {
    if (!selectedRow?.publicId) return;
    propertyMutationError = null;

    const options = propertyDraftType === 'select' ? parsePropertyOptions(propertyDraftOptions) : undefined;

    try {
      await store.createProperty({
        listPublicId: selectedRow.publicId,
        name: propertyDraftName,
        type: propertyDraftType,
        options
      });
      propertyDraftName = '';
      propertyDraftType = 'text';
      propertyDraftOptions = '';
    } catch (error) {
      propertyMutationError = describeError(error, 'Unable to create property.');
    }
  }

  async function handleRenameProperty() {
    if (!propertyRenameId) return;
    propertyMutationError = null;

    try {
      await store.renameProperty({ propertyId: propertyRenameId, name: propertyRenameName });
      cancelPropertyRename();
    } catch (error) {
      propertyMutationError = describeError(error, 'Unable to rename property.');
    }
  }

  async function handleReorderProperty(propertyId: string, targetIndex: number) {
    propertyMutationError = null;

    try {
      await store.reorderProperty({ propertyId, targetIndex });
      return true;
    } catch (error) {
      propertyMutationError = describeError(error, 'Unable to reorder property.');
      return false;
    }
  }

  async function handleRemoveProperty() {
    if (!pendingRemovePropertyId) return;
    propertyMutationError = null;
    const propertyId = pendingRemovePropertyId;

    try {
      await store.removeProperty({ propertyId });
      pendingRemovePropertyId = null;
      if (valueEditorPropertyId === propertyId) resetValueEditor();
    } catch (error) {
      propertyMutationError = describeError(error, 'Unable to remove property.');
    }
  }

  async function handleSavePropertyValue(property: VisibleListProperty) {
    if (!selectedItem) return;
    propertyMutationError = null;

    let payload: ListItemPropertyValueInput;

    switch (property.type) {
      case 'text':
        payload = { type: 'text', text: valueDraftText.trim() };
        break;
      case 'number':
        payload = { type: 'number', number: Number(valueDraftNumber) };
        break;
      case 'date': {
        const dateValue = parseDateInput(valueDraftDate);
        if (dateValue === null) {
          propertyMutationError = 'Choose a date before saving.';
          return;
        }
        payload = { type: 'date', date: dateValue };
        break;
      }
      case 'select':
        payload = { type: 'select', optionId: valueDraftSelectOptionId };
        break;
      case 'checkbox':
        payload = { type: 'checkbox', checked: valueDraftCheckbox };
        break;
    }

    try {
      await store.setPropertyValue({ itemId: selectedItem._id, propertyId: property._id, value: payload });
      resetValueEditor();
    } catch (error) {
      propertyMutationError = describeError(error, 'Unable to save value.');
    }
  }

  async function handleClearPropertyValue(propertyId: string) {
    if (!selectedItem) return;
    propertyMutationError = null;

    try {
      await store.clearPropertyValue({ itemId: selectedItem._id, propertyId });
      if (valueEditorPropertyId === propertyId) resetValueEditor();
    } catch (error) {
      propertyMutationError = describeError(error, 'Unable to clear value.');
    }
  }

  const visibleListRows = $derived(store.lists);
  const selectedListData = $derived(store.selected);
  const selectedRow = $derived(selectedListData?.list ?? null);
  const presentedLists = $derived(presentLists(visibleListRows, selectedRow?.publicId ?? selectedPublicId));
  const filteredLists = $derived(presentedLists.filter((list) => list.visibility === listFilter));
  const activeItems = $derived(selectedListData?.activeItems ?? []);
  const completedItems = $derived(selectedListData?.completedItems ?? []);
  const visibleProperties = $derived(selectedListData?.properties ?? []);
  const selectedItem = $derived(getSelectedItem(activeItems, completedItems, selectedItemId));

  function summarizeItemValues(item: VisibleListItem) {
    const parts: string[] = [];
    for (const property of visibleProperties) {
      const value = findPropertyValue(item, property._id);
      if (!value) continue;
      const described = describePropertyValue(property, value);
      if (described) parts.push(described);
    }
    return parts.join(' · ');
  }

  // svelte-dnd-action requires the bound `items` array to be updated on EVERY
  // consider/finalize event, so it is local $state seeded from the query/preview
  // source and frozen while a drag is in flight.
  let activeDndItems = $state<{ id: string; item: VisibleListItem }[]>([]);
  let isDraggingActive = $state(false);
  let pendingActiveOrder = $state<string[] | null>(null);

  $effect(() => {
    const next = activeItems.map((item) => ({ id: item._id, item }));
    if (isDraggingActive) return;
    if (pendingActiveOrder) {
      const sourceOrder = next.map((entry) => entry.id);
      if (sourceOrder.join('\0') !== pendingActiveOrder.join('\0')) return;
      pendingActiveOrder = null;
    }
    activeDndItems = next;
  });

  function handleActiveConsider(event: CustomEvent<DndEvent<{ id: string; item: VisibleListItem }>>) {
    isDraggingActive = true;
    activeDndItems = event.detail.items;
  }

  async function handleActiveFinalize(event: CustomEvent<DndEvent<{ id: string; item: VisibleListItem }>>) {
    activeDndItems = event.detail.items;
    const nextOrder = event.detail.items.map((entry) => entry.id);
    const movedId = event.detail.info.id;
    const targetIndex = nextOrder.indexOf(movedId);
    pendingActiveOrder = targetIndex >= 0 ? nextOrder : null;
    isDraggingActive = false;
    if (targetIndex < 0) return;

    try {
      await store.reorderItem({ itemId: movedId, targetIndex });
    } catch (error) {
      pendingActiveOrder = null;
      itemMutationError = describeError(error, 'Unable to reorder item.');
    }
  }

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
    // Explicit no-auth fixture mode is sticky and owns preview state; never override it.
    if (!browser || !dev || USE_DEV_FIXTURE) return;

    // A real response (data or error) means the backend is reachable — leave fallback.
    if (store.backendHasResponded) {
      autoOfflineFallback = false;
      return;
    }

    // Still no response — assume the Convex dev backend isn't running and fall back.
    const timeoutId = window.setTimeout(() => {
      autoOfflineFallback = true;
    }, OFFLINE_FALLBACK_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  });

  $effect(() => {
    const listPublicId = selectedRow?.publicId ?? null;
    if (listPublicId === previousListPublicId) return;
    previousListPublicId = listPublicId;
    selectedItemId = null;
    showMobileDetails = false;
    rightPanel = 'closed';
    resetValueEditor();
    cancelPropertyRename();
    pendingRemovePropertyId = null;
    propertyMutationError = null;
  });

  $effect(() => {
    if (!selectedItemId) return;
    if (selectedItem) return;
    selectedItemId = null;
    showMobileDetails = false;
    rightPanel = 'closed';
    resetValueEditor();
  });
</script>

{#snippet detailSurface()}
  <div class="flex h-full flex-col gap-4">
    {#if rightPanel === 'item' && selectedItem}
      <ItemDetailPanel
        item={selectedItem}
        properties={visibleProperties}
        completed={selectedItem.completedAt !== undefined}
        error={itemMutationError ?? propertyMutationError}
        onClose={() => {
          clearSelectedItem();
          closeMobileDetails();
        }}
        onRename={(title) => void handleRenameSelectedItem(title)}
        onSaveNotes={(notes) => void handleSaveSelectedNotes(notes)}
        onToggleComplete={() => void toggleItemCompletion(selectedItem)}
        onDelete={() => {
          void removeItem(selectedItem._id);
          clearSelectedItem();
          closeMobileDetails();
        }}
        {valueEditorPropertyId}
        {openValueEditor}
        {resetValueEditor}
        onSaveValue={(property) => void handleSavePropertyValue(property)}
        onClearValue={(propertyId) => void handleClearPropertyValue(propertyId)}
        {valueDraftText}
        {valueDraftNumber}
        {valueDraftDate}
        {valueDraftSelectOptionId}
        {valueDraftCheckbox}
        setValueDraftText={(value) => (valueDraftText = value)}
        setValueDraftNumber={(value) => (valueDraftNumber = value)}
        setValueDraftDate={(value) => (valueDraftDate = value)}
        setValueDraftSelectOptionId={(value) => (valueDraftSelectOptionId = value)}
        setValueDraftCheckbox={(value) => (valueDraftCheckbox = value)}
        {describePropertyValue}
        {findPropertyValue}
      />
    {:else}
    <ListSettingsPanel
      properties={visibleProperties}
      error={propertyMutationError}
      onClose={() => {
        rightPanel = 'closed';
        closeMobileDetails();
      }}
      onReorder={handleReorderProperty}
      {propertyRenameId}
      {propertyRenameName}
      setPropertyRenameName={(value) => (propertyRenameName = value)}
      beginRename={beginPropertyRename}
      cancelRename={cancelPropertyRename}
      onSaveRename={() => void handleRenameProperty()}
      pendingRemoveId={pendingRemovePropertyId}
      requestRemove={(propertyId) => {
        pendingRemovePropertyId = propertyId;
        cancelPropertyRename();
      }}
      cancelRemove={() => (pendingRemovePropertyId = null)}
      onConfirmRemove={() => void handleRemoveProperty()}
      draftName={propertyDraftName}
      setDraftName={(value) => (propertyDraftName = value)}
      draftType={propertyDraftType}
      setDraftType={(value) => (propertyDraftType = value)}
      draftOptions={propertyDraftOptions}
      setDraftOptions={(value) => (propertyDraftOptions = value)}
      onCreate={() => void handleCreateProperty()}
      {propertyTypeLabel}
      onDeleteList={() => {
        if (selectedRow) beginDelete(selectedRow as PresentedList);
      }}
    />
    {/if}
  </div>
{/snippet}

{#if autoOfflineFallback}
  <div
    role="status"
    class="mb-4 rounded-2xl border border-warm-border bg-warm-bg-card px-4 py-2 text-xs text-warm-accent"
  >
    Offline demo data — the Convex backend isn’t responding, so changes won’t be saved.
  </div>
{/if}

{#if selectedPublicId && !usePreviewData && store.selected === null && !store.selectedLoading}
  <section class="rounded-[32px] border border-warm-border bg-warm-bg-card p-8 text-sm text-warm-text-secondary">
    This list is unavailable.
  </section>
{:else if !usePreviewData && (store.listsLoading || (selectedPublicId && store.selectedLoading))}
  <section aria-hidden="true" class="sr-only">Loading Lists...</section>
{:else if !usePreviewData && store.listsError}
  <section class="rounded-[32px] border border-warm-border bg-warm-bg-card p-8 text-sm text-warm-text-secondary">
    {describeError(store.listsError, 'Unable to load lists right now.')}
  </section>
{:else}
  <section class="flex min-h-full flex-col gap-4 text-warm-text-primary md:h-full md:min-h-0 min-[1100px]:flex-row">
    <aside class="hidden rounded-[28px] border border-warm-border bg-warm-bg-card p-5 shadow-[0_18px_44px_rgb(20_17_12_/_10%)] min-[900px]:block min-[1100px]:w-[300px]">
       <div class="flex items-center justify-between">
          <h2 class="!mb-0 text-xl font-semibold text-warm-text-primary">My Lists</h2>
          <button
           type="button"
           class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warm-bg-dark text-sm font-semibold text-warm-text-on-dark"
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
            <button
              type="button"
              class={`w-full cursor-pointer rounded-2xl border p-[14px] text-left transition-colors ${
                list.selected ? 'border-warm-accent bg-warm-section-spend' : 'border-warm-border bg-warm-bg-card hover:bg-warm-section-mortgage'
              }`}
              onclick={() => void navigateToList(list)}
            >
              <div class="flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <p class={`truncate text-sm ${list.selected ? 'font-bold text-warm-text-primary' : 'font-semibold text-warm-text-secondary'}`}>
                    {list.name}
                  </p>
                  <p class="mt-1 text-[11px] text-warm-text-secondary">{list.description}</p>
                </div>
                <div class="relative">
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <span
                    role="button"
                    tabindex="0"
                    class="rounded-full px-2 py-1 text-sm text-warm-text-secondary hover:text-warm-text-primary"
                    aria-label={`List actions for ${list.name}`}
                    onclick={(e) => {
                      e.stopPropagation();
                      menuTargetPublicId = menuTargetPublicId === list.publicId ? null : list.publicId;
                    }}
                  >
                    •••
                  </span>

                  {#if menuTargetPublicId === list.publicId}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                      role="button"
                      tabindex="-1"
                      class="fixed inset-0 z-10"
                      onclick={(e) => { e.stopPropagation(); menuTargetPublicId = null; }}
                    ></div>
                    <div class="absolute right-0 top-8 z-20 w-36 rounded-2xl border border-warm-border bg-warm-bg-card p-2 shadow-[0_20px_40px_rgba(61,46,34,0.16)]">
                      <button
                        type="button"
                        class="flex w-full rounded-xl px-3 py-2 text-left text-sm text-warm-text-primary hover:bg-warm-bg"
                        onclick={(e) => { e.stopPropagation(); beginRename(list); }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        class="flex w-full rounded-xl px-3 py-2 text-left text-sm text-warm-accent hover:bg-warm-bg"
                        onclick={(e) => { e.stopPropagation(); beginDelete(list); }}
                      >
                        Delete
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            </button>
          {/each}
        {:else}
          <p class="text-sm text-warm-text-secondary">No {listFilter} lists yet.</p>
        {/if}
      </div>
    </aside>

    <section class="min-w-0 flex-1 rounded-[28px] border border-warm-border bg-warm-bg-card p-5 shadow-[0_18px_44px_rgb(20_17_12_/_10%)] md:flex md:min-h-0 md:flex-col">
      {#if selectedRow}
        <div class="flex flex-col gap-4 md:min-h-0 md:flex-1">
          <div class="flex items-center justify-between gap-2 min-[900px]:hidden">
            <button
              type="button"
              class="flex items-center gap-2 rounded-full bg-warm-bg-dark px-4 py-2 text-sm font-semibold text-warm-text-on-dark"
              onclick={() => (showListSwitcher = true)}
            >
              {selectedRow?.name ?? 'Lists'}
              <ListIcon name="chevron-down" size={16} />
            </button>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-full bg-warm-bg-dark text-warm-text-on-dark"
              aria-label="New list"
              onclick={() => {
                showCreateDialog = true;
                createVisibility = listFilter;
              }}
            >
              <ListIcon name="plus" size={18} />
            </button>
          </div>
          <div class="flex items-center justify-between">
            <h2 class="!mb-0 font-warm-display text-xl font-semibold text-warm-text-primary">
              {selectedRow.name}
            </h2>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-full border border-warm-border text-warm-text-secondary hover:text-warm-text-primary"
              aria-label="List settings"
              onclick={() => {
                selectedItemId = null;
                rightPanel = rightPanel === 'settings' ? 'closed' : 'settings';
                showMobileDetails = rightPanel === 'settings';
              }}
            >
              <ListIcon name="settings" size={18} />
            </button>
          </div>

          {#if itemMutationError}
            <p class="text-sm text-warm-accent">{itemMutationError}</p>
          {/if}

          <div class={`grid gap-4 md:min-h-0 md:flex-1 md:grid-rows-[minmax(0,1fr)] ${rightPanel !== 'closed' ? 'min-[900px]:grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
            <div class="flex flex-col gap-4 md:min-h-0">
              <form
                class="flex items-center gap-3 rounded-2xl border border-warm-border bg-warm-bg px-4 py-3"
                onsubmit={(event) => {
                  event.preventDefault();
                  void handleCreateItem();
                }}
              >
                <span class="text-warm-accent"><ListIcon name="plus" size={18} /></span>
                <input
                  bind:value={itemDraft}
                  onpaste={handleItemPaste}
                  class="flex-1 bg-transparent text-sm text-warm-text-primary outline-none placeholder:text-warm-text-tertiary"
                  placeholder="Add an item or paste a list..."
                />
                <button
                  type="submit"
                  class="rounded-full bg-warm-text-primary px-4 py-1.5 text-sm font-semibold text-warm-text-on-dark disabled:opacity-60"
                  disabled={!itemDraft.trim()}
                >
                  Add
                </button>
              </form>
              <section class="rounded-[24px] border border-warm-border bg-warm-bg p-2 md:flex md:min-h-0 md:flex-1 md:flex-col">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h3 class="pl-2 text-sm font-bold text-warm-text-primary">Items</h3>

                  </div>
                  <div class="flex items-center gap-2">
                    <span class="rounded-full bg-warm-section-mortgage px-3 py-1 text-[11px] font-semibold text-warm-text-secondary">
                      {activeItems.length}
                    </span>
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-full text-warm-text-tertiary hover:text-warm-accent disabled:opacity-40"
                      aria-label="Clear completed items"
                      title="Clear completed"
                      disabled={!completedItems.length}
                      onclick={() => void handleClearCompletedItems()}
                    >
                      <ListIcon name="trash" size={16} />
                    </button>
                  </div>
                </div>

                <div class="md:min-h-0 md:flex-1 md:overflow-y-auto">
                {#if activeDndItems.length}
                  <ul
                    class="mt-3 flex flex-col divide-y divide-warm-border/60"
                    use:dragHandleZone={{ items: activeDndItems, flipDurationMs: 160, dropTargetStyle: {} }}
                    onconsider={handleActiveConsider}
                    onfinalize={handleActiveFinalize}
                  >
                    {#each activeDndItems as entry (entry.id)}
                      <li>
                        <ListItemRow
                          item={entry.item}
                          valueSummary={summarizeItemValues(entry.item)}
                          completed={false}
                          selected={selectedItemId === entry.item._id}
                          onToggleComplete={() => void toggleItemCompletion(entry.item)}
                          onOpenDetail={() => openItemDetails(entry.item._id)}
                          onDelete={() => void removeItem(entry.item._id)}
                        />
                      </li>
                    {/each}
                  </ul>
                {:else if !completedItems.length}
                  <p class="mt-4 pl-4 text-sm text-warm-text-secondary">No items yet.</p>
                {/if}

                {#if completedItems.length}
                  <ul class="mt-1 flex flex-col divide-y divide-warm-border/60">
                    {#each completedItems as item (item._id)}
                      <li>
                        <ListItemRow
                          {item}
                          valueSummary={summarizeItemValues(item)}
                          completed={true}
                          selected={selectedItemId === item._id}
                          onToggleComplete={() => void toggleItemCompletion(item)}
                          onOpenDetail={() => openItemDetails(item._id)}
                          onDelete={() => void removeItem(item._id)}
                        />
                      </li>
                    {/each}
                  </ul>
                {/if}
                </div>
              </section>

            </div>

            {#if rightPanel !== 'closed'}
              <aside class="hidden h-full rounded-[24px] border border-warm-border bg-warm-bg p-4 min-[900px]:block">
                {@render detailSurface()}
              </aside>
            {/if}
          </div>
        </div>
      {:else}
        <div class="rounded-[24px] border border-warm-border bg-warm-bg p-6 text-sm text-warm-text-secondary">
          Create a list or select one from the sidebar.
        </div>
      {/if}
    </section>

    {#if showMobileDetails}
      <button
        type="button"
        class="fixed inset-0 z-40 bg-[#2D2D2D99] min-[900px]:hidden"
        aria-label="Close details"
        onclick={() => closeMobileDetails()}
        transition:fade={{ duration: 250 }}
      ></button>
      <section
        class="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-[28px] border border-warm-border bg-warm-bg-card p-5 shadow-[0_-12px_40px_rgba(61,46,34,0.18)] min-[900px]:hidden"
        transition:fly={{ y: 800, duration: 350, easing: cubicOut }}
      >
        {@render detailSurface()}
      </section>
    {/if}

    {#if showListSwitcher}
      <button
        type="button"
        class="fixed inset-0 z-40 bg-[#2D2D2D99] min-[900px]:hidden"
        aria-label="Close list switcher"
        onclick={() => (showListSwitcher = false)}
        transition:fade={{ duration: 250 }}
      ></button>
      <section
        class="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-[28px] border border-warm-border bg-warm-bg-card p-5 shadow-[0_-12px_40px_rgba(61,46,34,0.18)] min-[900px]:hidden"
        transition:fly={{ y: 800, duration: 350, easing: cubicOut }}
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="!mb-0 text-base font-semibold text-warm-text-primary">My Lists</h2>
          <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full text-warm-text-secondary" aria-label="Close list switcher" onclick={() => (showListSwitcher = false)}>
            <ListIcon name="close" size={16} />
          </button>
        </div>
        <div class="flex rounded-full bg-warm-section-mortgage p-1">
          <button type="button" class={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${listFilter === 'personal' ? 'bg-warm-text-primary text-warm-text-on-dark' : 'text-warm-text-secondary'}`} onclick={() => (listFilter = 'personal')}>Personal</button>
          <button type="button" class={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${listFilter === 'shared' ? 'bg-warm-text-primary text-warm-text-on-dark' : 'text-warm-text-secondary'}`} onclick={() => (listFilter = 'shared')}>Shared</button>
        </div>
        <div class="mt-3 flex flex-col gap-2">
          {#each filteredLists as list (list.publicId)}
            <button
              type="button"
              class={`rounded-2xl border p-3 text-left ${list.selected ? 'border-warm-accent bg-warm-section-spend' : 'border-warm-border bg-warm-bg-card'}`}
              onclick={() => {
                showListSwitcher = false;
                void navigateToList(list);
              }}
            >
              <p class={`truncate text-sm ${list.selected ? 'font-bold text-warm-text-primary' : 'font-semibold text-warm-text-secondary'}`}>{list.name}</p>
              <p class="mt-0.5 text-[11px] text-warm-text-secondary">{list.description}</p>
            </button>
          {/each}
          {#if !filteredLists.length}
            <p class="text-sm text-warm-text-secondary">No {listFilter} lists yet.</p>
          {/if}
        </div>
        <button
          type="button"
          class="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-warm-border px-4 py-2 text-sm font-semibold text-warm-text-secondary"
          onclick={() => {
            showListSwitcher = false;
            showCreateDialog = true;
            createVisibility = listFilter;
          }}
        >
          <ListIcon name="plus" size={16} /> New list
        </button>
      </section>
    {/if}

    <dialog
      bind:this={pasteDialog}
      aria-labelledby="paste-preview-title"
      class="m-auto w-[calc(100vw-2rem)] max-w-md rounded-[28px] border border-warm-border bg-warm-bg-card p-5 text-warm-text-primary shadow-[0_24px_60px_rgba(61,46,34,0.2)] backdrop:bg-[#2D2D2D99]"
      onclose={resetPastePreview}
      onclick={(event) => {
        if (event.target === pasteDialog) pasteDialog?.close();
      }}
    >
      {#if pastePreview}
        <h2 id="paste-preview-title" class="font-warm-display text-[20px] text-warm-text-primary">
          Add pasted items
        </h2>
        <p class="mt-1 text-sm text-warm-text-secondary">
          Review the items below before adding them to the list.
        </p>

        <ul class="mt-4 flex max-h-[46vh] flex-col gap-1.5 overflow-y-auto">
          {#each pastePreview as entry, index (index)}
            {#if entry.kind === 'item'}
              <li
                class="flex items-center justify-between gap-2 rounded-2xl border border-warm-border bg-warm-bg px-3 py-2"
              >
                <span class="text-sm text-warm-text-primary">{entry.text}</span>
                <button
                  type="button"
                  class="text-warm-text-tertiary hover:text-warm-accent"
                  aria-label={`Remove ${entry.text}`}
                  onclick={() => removePastePreviewItem(index)}
                >
                  <ListIcon name="close" size={16} />
                </button>
              </li>
            {:else}
              <li class="flex items-center gap-2 px-3 py-1.5 text-xs text-warm-text-tertiary">
                <span class="font-semibold uppercase tracking-wide">{entry.text}</span>
                <span class="rounded-full bg-warm-section-mortgage px-2 py-0.5 text-[10px] font-semibold">
                  heading · skipped
                </span>
              </li>
            {/if}
          {/each}
        </ul>

        {#if pastePreviewError}
          <p class="mt-3 text-sm text-warm-accent" role="alert">{pastePreviewError}</p>
        {/if}

        <div class="mt-5 flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-full border border-warm-border px-4 py-3 text-sm font-medium text-warm-text-secondary"
            onclick={() => pasteDialog?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 rounded-full bg-warm-text-primary px-4 py-3 text-sm font-bold text-warm-text-on-dark disabled:opacity-60"
            disabled={pastePreviewItemCount === 0 || pasteSubmitting}
            onclick={() => void confirmPastePreview()}
          >
            {#if pasteSubmitting}
              Adding…
            {:else}
              Add {pastePreviewItemCount}
              {pastePreviewItemCount === 1 ? 'item' : 'items'}
            {/if}
          </button>
        </div>
      {/if}
    </dialog>

    <dialog
      bind:this={listDialog}
      aria-labelledby="list-dialog-title"
      class="m-auto w-[calc(100vw-2rem)] max-w-md rounded-[28px] border border-warm-border bg-warm-bg-card p-5 text-warm-text-primary shadow-[0_24px_60px_rgba(61,46,34,0.2)] backdrop:bg-[#2D2D2D99]"
      onclose={resetListDialog}
      onclick={(event) => {
        if (event.target === listDialog) listDialog?.close();
      }}
    >
      {#if listDialogOpen}
        {#if showCreateDialog}
          <h2 id="list-dialog-title" class="font-warm-display text-[20px] text-warm-text-primary">New list</h2>

          <form
            class="mt-4 flex flex-col gap-3"
            onsubmit={(event) => {
              event.preventDefault();
              void handleCreateList();
            }}
          >
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

            <input
              bind:value={createName}
              class="rounded-2xl border border-warm-border bg-warm-bg px-4 py-3 text-sm text-warm-text-primary outline-none ring-0"
              placeholder="Weekly shop"
            />

            <div class="mt-2 flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-full border border-warm-border px-4 py-3 text-sm font-medium text-warm-text-secondary"
                onclick={() => listDialog?.close()}
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
          <h2 id="list-dialog-title" class="font-warm-display text-[26px] text-warm-text-primary">Rename list</h2>
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
                onclick={() => listDialog?.close()}
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
          <h2 id="list-dialog-title" class="font-warm-display text-[26px] text-warm-text-primary">Delete list</h2>
          <p class="mt-2 text-sm text-warm-text-secondary">This removes the list and its items from the current view.</p>

          <div class="mt-5 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-full border border-warm-border px-4 py-3 text-sm font-medium text-warm-text-secondary"
              onclick={() => listDialog?.close()}
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
      {/if}
    </dialog>
  </section>
{/if}
