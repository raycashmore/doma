import { api } from '@repo/convex';
import { slugifyListName } from '@repo/convex/lists/model';
import {
  type ListItemPropertyValueInput,
  markActive,
  markCompleted,
  nextActiveSortOrder,
  propertyValuePatch,
  reorderByIndex
} from '@repo/convex/lists/transitions';
import { useMutation, useQuery } from 'convex-svelte';

import type {
  VisibleList,
  VisibleListItem,
  VisibleListItemPropertyValue,
  VisibleListItemsResult,
  VisibleListProperty
} from './presenter';

export type ListRouteTarget = { publicId: string; slug: string };

/**
 * The seam the Lists screen reads and writes through. Reactive getters expose
 * the visible lists and the selected list's items/properties; the command
 * methods mutate them and throw on failure (the screen routes the error to a
 * banner). Two adapters satisfy it: {@link ConvexListStore} (live backend) and
 * {@link InMemoryListStore} (dev fixture / offline fallback).
 */
export type ListStore = {
  readonly lists: VisibleList[];
  readonly listsLoading: boolean;
  readonly listsError: Error | null;
  readonly selected: VisibleListItemsResult | null;
  readonly selectedLoading: boolean;
  readonly selectedError: Error | null;

  createList(input: { name: string; visibility: 'personal' | 'shared' }): Promise<ListRouteTarget>;
  renameList(input: { publicId: string; name: string }): Promise<ListRouteTarget>;
  deleteList(input: { publicId: string }): Promise<void>;

  createItem(input: { listPublicId: string; title: string }): Promise<void>;
  createItems(input: { listPublicId: string; titles: string[] }): Promise<void>;
  renameItem(input: { itemId: string; title: string }): Promise<void>;
  setItemNotes(input: { itemId: string; notes: string }): Promise<void>;
  deleteItem(input: { itemId: string }): Promise<void>;
  completeItem(input: { itemId: string }): Promise<void>;
  uncompleteItem(input: { itemId: string }): Promise<void>;
  reorderItem(input: { itemId: string; targetIndex: number }): Promise<void>;
  clearCompleted(input: { listPublicId: string }): Promise<void>;

  createProperty(input: {
    listPublicId: string;
    name: string;
    type: VisibleListProperty['type'];
    options?: VisibleListProperty['options'];
  }): Promise<void>;
  renameProperty(input: { propertyId: string; name: string }): Promise<void>;
  reorderProperty(input: { propertyId: string; targetIndex: number }): Promise<void>;
  removeProperty(input: { propertyId: string }): Promise<void>;
  setPropertyValue(input: { itemId: string; propertyId: string; value: ListItemPropertyValueInput }): Promise<void>;
  clearPropertyValue(input: { itemId: string; propertyId: string }): Promise<void>;
};

type InMemorySeed = {
  getSelectedPublicId: () => string | null;
  seedLists: readonly VisibleList[];
  seedItemsByListPublicId: Record<string, VisibleListItemsResult>;
};

/**
 * In-memory adapter for the dev fixture and the reversible offline fallback.
 * Owns the list data as `$state` and applies the shared pure transitions, so it
 * mirrors the Convex backend's placement and ordering rules exactly. Edits are
 * intentionally throwaway — they vanish when a live backend takes over.
 */
export class InMemoryListStore implements ListStore {
  #getSelectedPublicId: () => string | null;
  #lists = $state<VisibleList[]>([]);
  #itemsByPublicId = $state<Record<string, VisibleListItemsResult>>({});

  constructor(seed: InMemorySeed) {
    this.#getSelectedPublicId = seed.getSelectedPublicId;
    this.#lists = [...seed.seedLists];
    this.#itemsByPublicId = structuredClone(seed.seedItemsByListPublicId);
  }

  get lists(): VisibleList[] {
    return this.#lists;
  }

  get listsLoading(): boolean {
    return false;
  }

  get listsError(): Error | null {
    return null;
  }

  get selectedLoading(): boolean {
    return false;
  }

  get selectedError(): Error | null {
    return null;
  }

  get selected(): VisibleListItemsResult | null {
    const id = this.#getSelectedPublicId();
    if (id && this.#itemsByPublicId[id]) return this.#itemsByPublicId[id];
    const first = this.#lists[0];
    return first ? (this.#itemsByPublicId[first.publicId] ?? null) : null;
  }

  #updateList(publicId: string, updater: (current: VisibleListItemsResult) => VisibleListItemsResult) {
    const current = this.#itemsByPublicId[publicId];
    if (!current) return;
    this.#itemsByPublicId = { ...this.#itemsByPublicId, [publicId]: updater(current) };
  }

  #publicIdForItem(itemId: string): string | null {
    for (const [publicId, result] of Object.entries(this.#itemsByPublicId)) {
      if ([...result.activeItems, ...result.completedItems].some((item) => item._id === itemId)) return publicId;
    }
    return null;
  }

  #updateItemList(itemId: string, updater: (current: VisibleListItemsResult) => VisibleListItemsResult) {
    const publicId = this.#publicIdForItem(itemId);
    if (publicId) this.#updateList(publicId, updater);
  }

  #updatePropertyList(propertyId: string, updater: (current: VisibleListItemsResult) => VisibleListItemsResult) {
    for (const [publicId, result] of Object.entries(this.#itemsByPublicId)) {
      if (result.properties.some((property) => property._id === propertyId)) {
        this.#updateList(publicId, updater);
        return;
      }
    }
  }

  #patchItem(itemId: string, patch: (item: VisibleListItem) => VisibleListItem) {
    const apply = (item: VisibleListItem) => (item._id === itemId ? patch(item) : item);
    this.#updateItemList(itemId, (current) => ({
      ...current,
      activeItems: current.activeItems.map(apply),
      completedItems: current.completedItems.map(apply)
    }));
  }

  async createList({
    name,
    visibility
  }: {
    name: string;
    visibility: 'personal' | 'shared';
  }): Promise<ListRouteTarget> {
    const resolvedName = name.trim() || 'Untitled list';
    const slug = slugifyListName(resolvedName);
    const created: VisibleList = {
      _id: `preview-${crypto.randomUUID()}`,
      publicId: slug,
      slug,
      name: resolvedName,
      visibility,
      createdByUserId: 'preview-user'
    };

    this.#lists = [created, ...this.#lists];
    this.#itemsByPublicId = {
      ...this.#itemsByPublicId,
      [created.publicId]: { list: created, properties: [], activeItems: [], completedItems: [] }
    };
    return { publicId: created.publicId, slug: created.slug };
  }

  async renameList({ publicId, name }: { publicId: string; name: string }): Promise<ListRouteTarget> {
    const resolvedName = name.trim() || 'Untitled list';
    const slug = slugifyListName(resolvedName);

    this.#lists = this.#lists.map((list) =>
      list.publicId === publicId ? { ...list, name: resolvedName, slug } : list
    );
    this.#updateList(publicId, (current) => ({
      ...current,
      list: { ...current.list, name: resolvedName, slug }
    }));
    return { publicId, slug };
  }

  async deleteList({ publicId }: { publicId: string }): Promise<void> {
    this.#lists = this.#lists.filter((list) => list.publicId !== publicId);
    const rest = { ...this.#itemsByPublicId };
    delete rest[publicId];
    this.#itemsByPublicId = rest;
  }
  async createItem({ listPublicId, title }: { listPublicId: string; title: string }): Promise<void> {
    await this.createItems({ listPublicId, titles: [title] });
  }

  async createItems({ listPublicId, titles }: { listPublicId: string; titles: string[] }): Promise<void> {
    const normalized = titles.map((title) => title.trim()).filter((title) => title.length > 0);
    if (normalized.length === 0) return;

    this.#updateList(listPublicId, (current) => {
      const now = Date.now();
      const base = nextActiveSortOrder(current.activeItems);
      const created: VisibleListItem[] = normalized.map((title, index) => ({
        _id: `preview-item-${crypto.randomUUID()}`,
        listId: current.list._id,
        title,
        sortOrder: base + index,
        createdAt: now,
        updatedAt: now,
        propertyValues: []
      }));
      return { ...current, activeItems: [...current.activeItems, ...created] };
    });
  }
  async renameItem({ itemId, title }: { itemId: string; title: string }): Promise<void> {
    const resolved = title.trim();
    if (!resolved) return;
    this.#patchItem(itemId, (item) => ({ ...item, title: resolved, updatedAt: Date.now() }));
  }

  async setItemNotes({ itemId, notes }: { itemId: string; notes: string }): Promise<void> {
    const trimmed = notes.trim();
    this.#patchItem(itemId, (item) => ({ ...item, notes: trimmed || undefined, updatedAt: Date.now() }));
  }
  async deleteItem({ itemId }: { itemId: string }): Promise<void> {
    // Drop the item (and its values) without renumbering survivors — gaps are
    // harmless and this mirrors the backend, which leaves the order untouched.
    this.#updateItemList(itemId, (current) => ({
      ...current,
      activeItems: current.activeItems.filter((entry) => entry._id !== itemId),
      completedItems: current.completedItems.filter((entry) => entry._id !== itemId)
    }));
  }
  async completeItem({ itemId }: { itemId: string }): Promise<void> {
    this.#updateItemList(itemId, (current) => {
      const item = current.activeItems.find((entry) => entry._id === itemId);
      if (!item) return current;
      // Leave the gap in the active order — completing never renumbers, matching Convex.
      return {
        ...current,
        activeItems: current.activeItems.filter((entry) => entry._id !== itemId),
        completedItems: [markCompleted(item, Date.now()), ...current.completedItems]
      };
    });
  }

  async uncompleteItem({ itemId }: { itemId: string }): Promise<void> {
    this.#updateItemList(itemId, (current) => {
      const item = current.completedItems.find((entry) => entry._id === itemId);
      if (!item) return current;
      return {
        ...current,
        activeItems: [...current.activeItems, markActive(item, current.activeItems, Date.now())],
        completedItems: current.completedItems.filter((entry) => entry._id !== itemId)
      };
    });
  }
  async reorderItem({ itemId, targetIndex }: { itemId: string; targetIndex: number }): Promise<void> {
    this.#updateItemList(itemId, (current) => ({
      ...current,
      activeItems: reorderByIndex(current.activeItems, itemId, targetIndex)
    }));
  }

  async clearCompleted({ listPublicId }: { listPublicId: string }): Promise<void> {
    this.#updateList(listPublicId, (current) => ({ ...current, completedItems: [] }));
  }
  async createProperty({
    listPublicId,
    name,
    type,
    options
  }: {
    listPublicId: string;
    name: string;
    type: VisibleListProperty['type'];
    options?: VisibleListProperty['options'];
  }): Promise<void> {
    this.#updateList(listPublicId, (current) => {
      const property: VisibleListProperty = {
        _id: `preview-property-${crypto.randomUUID()}`,
        listId: current.list._id,
        name: name.trim(),
        type,
        sortOrder: current.properties.length,
        options
      };
      return { ...current, properties: [...current.properties, property] };
    });
  }

  async renameProperty({ propertyId, name }: { propertyId: string; name: string }): Promise<void> {
    const resolved = name.trim();
    if (!resolved) return;
    this.#updatePropertyList(propertyId, (current) => ({
      ...current,
      properties: current.properties.map((property) =>
        property._id === propertyId ? { ...property, name: resolved } : property
      )
    }));
  }

  async reorderProperty({ propertyId, targetIndex }: { propertyId: string; targetIndex: number }): Promise<void> {
    this.#updatePropertyList(propertyId, (current) => ({
      ...current,
      properties: reorderByIndex(current.properties, propertyId, targetIndex)
    }));
  }

  async removeProperty({ propertyId }: { propertyId: string }): Promise<void> {
    this.#updatePropertyList(propertyId, (current) => {
      // Properties resequence densely on removal (matching Convex), and the
      // removed property's values are stripped from every item.
      const survivors = current.properties
        .filter((property) => property._id !== propertyId)
        .map((property, index) => ({ ...property, sortOrder: index }));
      const stripValues = (item: VisibleListItem): VisibleListItem => ({
        ...item,
        propertyValues: item.propertyValues.filter((value) => value.listPropertyId !== propertyId)
      });
      return {
        ...current,
        properties: survivors,
        activeItems: current.activeItems.map(stripValues),
        completedItems: current.completedItems.map(stripValues)
      };
    });
  }
  async setPropertyValue({
    itemId,
    propertyId,
    value
  }: {
    itemId: string;
    propertyId: string;
    value: ListItemPropertyValueInput;
  }): Promise<void> {
    this.#updateItemList(itemId, (current) => {
      const property = current.properties.find((entry) => entry._id === propertyId);
      if (!property) return current;
      const patch = propertyValuePatch(property, value);

      const apply = (item: VisibleListItem): VisibleListItem => {
        if (item._id !== itemId) return item;
        const existingIndex = item.propertyValues.findIndex((entry) => entry.listPropertyId === propertyId);
        const nextValue: VisibleListItemPropertyValue = {
          _id: existingIndex >= 0 ? item.propertyValues[existingIndex]!._id : `preview-value-${crypto.randomUUID()}`,
          listItemId: item._id,
          listPropertyId: propertyId,
          ...patch
        };
        const propertyValues =
          existingIndex >= 0
            ? item.propertyValues.map((entry, index) => (index === existingIndex ? nextValue : entry))
            : [...item.propertyValues, nextValue];
        return { ...item, propertyValues };
      };

      return {
        ...current,
        activeItems: current.activeItems.map(apply),
        completedItems: current.completedItems.map(apply)
      };
    });
  }

  async clearPropertyValue({ itemId, propertyId }: { itemId: string; propertyId: string }): Promise<void> {
    this.#updateItemList(itemId, (current) => {
      const apply = (item: VisibleListItem): VisibleListItem =>
        item._id === itemId
          ? { ...item, propertyValues: item.propertyValues.filter((entry) => entry.listPropertyId !== propertyId) }
          : item;
      return {
        ...current,
        activeItems: current.activeItems.map(apply),
        completedItems: current.completedItems.map(apply)
      };
    });
  }
}

type ConvexSeed = {
  /** False in the explicit dev fixture mode, so the live queries never run. */
  enabled: boolean;
  getSelectedPublicId: () => string | null;
};

/**
 * Live adapter: a thin pass-through over the Convex queries and mutations. Reads
 * come back through the `useQuery` subscriptions; each command is one mutation
 * call. The `as never` casts for branded ids live here, behind the seam, so the
 * screen never deals with them.
 */
export class ConvexListStore implements ListStore {
  #lists;
  #items;
  #createList = useMutation(api.lists.mutations.createList);
  #renameList = useMutation(api.lists.mutations.renameList);
  #deleteList = useMutation(api.lists.mutations.deleteList);
  #createListItem = useMutation(api.lists.mutations.createListItem);
  #createListItems = useMutation(api.lists.mutations.createListItems);
  #renameListItem = useMutation(api.lists.mutations.renameListItem);
  #deleteListItem = useMutation(api.lists.mutations.deleteListItem);
  #completeListItem = useMutation(api.lists.mutations.completeListItem);
  #uncompleteListItem = useMutation(api.lists.mutations.uncompleteListItem);
  #reorderListItem = useMutation(api.lists.mutations.reorderListItem);
  #clearCompletedListItems = useMutation(api.lists.mutations.clearCompletedListItems);
  #createListProperty = useMutation(api.lists.mutations.createListProperty);
  #renameListProperty = useMutation(api.lists.mutations.renameListProperty);
  #reorderListProperty = useMutation(api.lists.mutations.reorderListProperty);
  #removeListProperty = useMutation(api.lists.mutations.removeListProperty);
  #setListItemPropertyValue = useMutation(api.lists.mutations.setListItemPropertyValue);
  #clearListItemPropertyValue = useMutation(api.lists.mutations.clearListItemPropertyValue);
  #setListItemNotes = useMutation(api.lists.mutations.setListItemNotes);

  constructor(seed: ConvexSeed) {
    this.#lists = useQuery(api.lists.queries.listVisibleToMe, () => (seed.enabled ? {} : 'skip'));
    this.#items = useQuery(api.lists.queries.getVisibleListItemsByPublicId, () => {
      if (!seed.enabled) return 'skip';
      const publicId = seed.getSelectedPublicId();
      return publicId ? { publicId } : 'skip';
    });
  }

  /** True once either live query has produced data or an error. */
  get hasResponded(): boolean {
    return (
      this.#lists.data !== undefined ||
      this.#lists.error !== undefined ||
      this.#items.data !== undefined ||
      this.#items.error !== undefined
    );
  }

  get lists(): VisibleList[] {
    return this.#lists.data ?? [];
  }
  get listsLoading(): boolean {
    return this.#lists.isLoading;
  }
  get listsError(): Error | null {
    return this.#lists.error ?? null;
  }
  get selected(): VisibleListItemsResult | null {
    return this.#items.data ?? null;
  }
  get selectedLoading(): boolean {
    return this.#items.isLoading;
  }
  get selectedError(): Error | null {
    return this.#items.error ?? null;
  }

  async createList(input: { name: string; visibility: 'personal' | 'shared' }): Promise<ListRouteTarget> {
    const created = await this.#createList(input);
    return { publicId: created.publicId, slug: created.slug };
  }
  async renameList(input: { publicId: string; name: string }): Promise<ListRouteTarget> {
    const renamed = await this.#renameList(input);
    return { publicId: renamed.publicId, slug: renamed.slug };
  }
  async deleteList(input: { publicId: string }): Promise<void> {
    await this.#deleteList(input);
  }
  async createItem(input: { listPublicId: string; title: string }): Promise<void> {
    await this.#createListItem(input);
  }
  async createItems(input: { listPublicId: string; titles: string[] }): Promise<void> {
    await this.#createListItems(input);
  }
  async renameItem(input: { itemId: string; title: string }): Promise<void> {
    await this.#renameListItem({ itemId: input.itemId as never, title: input.title });
  }
  async setItemNotes(input: { itemId: string; notes: string }): Promise<void> {
    await this.#setListItemNotes({ itemId: input.itemId as never, notes: input.notes });
  }
  async deleteItem(input: { itemId: string }): Promise<void> {
    await this.#deleteListItem({ itemId: input.itemId as never });
  }
  async completeItem(input: { itemId: string }): Promise<void> {
    await this.#completeListItem({ itemId: input.itemId as never });
  }
  async uncompleteItem(input: { itemId: string }): Promise<void> {
    await this.#uncompleteListItem({ itemId: input.itemId as never });
  }
  async reorderItem(input: { itemId: string; targetIndex: number }): Promise<void> {
    await this.#reorderListItem({ itemId: input.itemId as never, targetIndex: input.targetIndex });
  }
  async clearCompleted(input: { listPublicId: string }): Promise<void> {
    await this.#clearCompletedListItems(input);
  }
  async createProperty(input: {
    listPublicId: string;
    name: string;
    type: VisibleListProperty['type'];
    options?: VisibleListProperty['options'];
  }): Promise<void> {
    await this.#createListProperty({
      listPublicId: input.listPublicId,
      name: input.name,
      type: input.type as never,
      options: input.options
    });
  }
  async renameProperty(input: { propertyId: string; name: string }): Promise<void> {
    await this.#renameListProperty({ propertyId: input.propertyId as never, name: input.name });
  }
  async reorderProperty(input: { propertyId: string; targetIndex: number }): Promise<void> {
    await this.#reorderListProperty({ propertyId: input.propertyId as never, targetIndex: input.targetIndex });
  }
  async removeProperty(input: { propertyId: string }): Promise<void> {
    await this.#removeListProperty({ propertyId: input.propertyId as never });
  }
  async setPropertyValue(input: {
    itemId: string;
    propertyId: string;
    value: ListItemPropertyValueInput;
  }): Promise<void> {
    await this.#setListItemPropertyValue({
      itemId: input.itemId as never,
      propertyId: input.propertyId as never,
      value: input.value as never
    });
  }
  async clearPropertyValue(input: { itemId: string; propertyId: string }): Promise<void> {
    await this.#clearListItemPropertyValue({
      itemId: input.itemId as never,
      propertyId: input.propertyId as never
    });
  }
}

type FacadeSeed = {
  /** Static: explicit dev fixture mode (no Clerk key). Fixtures are sticky. */
  useDevFixture: boolean;
  /** Reactive: dev fixture OR the reversible offline fallback is active. */
  getUsePreview: () => boolean;
  getSelectedPublicId: () => string | null;
  seedLists: readonly VisibleList[];
  seedItemsByListPublicId: Record<string, VisibleListItemsResult>;
};

/**
 * The seam the screen holds. Constructed once at component init (so `useQuery`
 * is legal), it owns both adapters and delegates reads and writes to whichever
 * the reactive `getUsePreview` flag selects. The live adapter keeps running even
 * while preview is active, so `backendHasResponded` lets the screen retire the
 * offline fallback the instant the backend answers.
 */
export class ListStoreFacade implements ListStore {
  #inMemory: InMemoryListStore;
  #convex: ConvexListStore;
  #getUsePreview: () => boolean;

  constructor(seed: FacadeSeed) {
    this.#getUsePreview = seed.getUsePreview;
    this.#convex = new ConvexListStore({
      enabled: !seed.useDevFixture,
      getSelectedPublicId: seed.getSelectedPublicId
    });
    this.#inMemory = new InMemoryListStore({
      getSelectedPublicId: seed.getSelectedPublicId,
      seedLists: seed.seedLists,
      seedItemsByListPublicId: seed.seedItemsByListPublicId
    });
  }

  get #active(): ListStore {
    return this.#getUsePreview() ? this.#inMemory : this.#convex;
  }

  get backendHasResponded(): boolean {
    return this.#convex.hasResponded;
  }

  get lists(): VisibleList[] {
    return this.#active.lists;
  }
  get listsLoading(): boolean {
    return this.#active.listsLoading;
  }
  get listsError(): Error | null {
    return this.#active.listsError;
  }
  get selected(): VisibleListItemsResult | null {
    return this.#active.selected;
  }
  get selectedLoading(): boolean {
    return this.#active.selectedLoading;
  }
  get selectedError(): Error | null {
    return this.#active.selectedError;
  }

  createList(input: { name: string; visibility: 'personal' | 'shared' }): Promise<ListRouteTarget> {
    return this.#active.createList(input);
  }
  renameList(input: { publicId: string; name: string }): Promise<ListRouteTarget> {
    return this.#active.renameList(input);
  }
  deleteList(input: { publicId: string }): Promise<void> {
    return this.#active.deleteList(input);
  }
  createItem(input: { listPublicId: string; title: string }): Promise<void> {
    return this.#active.createItem(input);
  }
  createItems(input: { listPublicId: string; titles: string[] }): Promise<void> {
    return this.#active.createItems(input);
  }
  renameItem(input: { itemId: string; title: string }): Promise<void> {
    return this.#active.renameItem(input);
  }
  setItemNotes(input: { itemId: string; notes: string }): Promise<void> {
    return this.#active.setItemNotes(input);
  }
  deleteItem(input: { itemId: string }): Promise<void> {
    return this.#active.deleteItem(input);
  }
  completeItem(input: { itemId: string }): Promise<void> {
    return this.#active.completeItem(input);
  }
  uncompleteItem(input: { itemId: string }): Promise<void> {
    return this.#active.uncompleteItem(input);
  }
  reorderItem(input: { itemId: string; targetIndex: number }): Promise<void> {
    return this.#active.reorderItem(input);
  }
  clearCompleted(input: { listPublicId: string }): Promise<void> {
    return this.#active.clearCompleted(input);
  }
  createProperty(input: {
    listPublicId: string;
    name: string;
    type: VisibleListProperty['type'];
    options?: VisibleListProperty['options'];
  }): Promise<void> {
    return this.#active.createProperty(input);
  }
  renameProperty(input: { propertyId: string; name: string }): Promise<void> {
    return this.#active.renameProperty(input);
  }
  reorderProperty(input: { propertyId: string; targetIndex: number }): Promise<void> {
    return this.#active.reorderProperty(input);
  }
  removeProperty(input: { propertyId: string }): Promise<void> {
    return this.#active.removeProperty(input);
  }
  setPropertyValue(input: { itemId: string; propertyId: string; value: ListItemPropertyValueInput }): Promise<void> {
    return this.#active.setPropertyValue(input);
  }
  clearPropertyValue(input: { itemId: string; propertyId: string }): Promise<void> {
    return this.#active.clearPropertyValue(input);
  }
}

export type { ListItemPropertyValueInput };
