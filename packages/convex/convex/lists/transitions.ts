// Pure list transitions shared by the Convex mutation handlers (functional core,
// imperative shell: compute desired state here, persist in the handler) and the
// client-side in-memory ListStore adapter. They operate on minimal structural
// shapes so both `Doc<'listItems'>` rows and client `VisibleListItem`s satisfy
// them. See the "Active item order" term in CONTEXT.md.

type Ordered = { sortOrder: number };
type Identified = { _id: string };
type Completable = Ordered & { completedAt?: number; updatedAt: number };

export type ListPropertyType = 'text' | 'number' | 'date' | 'select' | 'checkbox';

/** A new value for an item's list property, discriminated by property type. */
export type ListItemPropertyValueInput =
  | { type: 'text'; text: string }
  | { type: 'number'; number: number }
  | { type: 'date'; date: number }
  | { type: 'select'; optionId: string }
  | { type: 'checkbox'; checked: boolean };

/** The stored value fields a property value can carry. */
export type ListItemPropertyValuePatch = {
  textValue?: string;
  numberValue?: number;
  dateValue?: number;
  selectOptionId?: string;
  checkboxValue?: boolean;
};

/**
 * The sort order for a newly added active item: one past the highest existing
 * order, or 0 when there are none. Using the count instead would slot the item
 * into a gap left by completed/deleted items.
 */
export function nextActiveSortOrder(activeItems: readonly Ordered[]): number {
  return activeItems.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0);
}

/**
 * Move the entry with `movedId` to `targetIndex` within an ordered collection
 * and renumber every entry's `sortOrder` densely from 0. Shared by active-item
 * and list-property reordering. `targetIndex` is clamped into range; an unknown
 * `movedId` returns the input unchanged so the caller can treat it as a no-op.
 * Renumbering only; `updatedAt` bumps are left to the persisting shell.
 */
export function reorderByIndex<T extends Ordered & Identified>(
  items: readonly T[],
  movedId: string,
  targetIndex: number
): T[] {
  const currentIndex = items.findIndex((item) => item._id === movedId);
  if (currentIndex === -1) return [...items];

  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, items.length - 1));

  const reordered = [...items];
  const [moved] = reordered.splice(currentIndex, 1);
  if (!moved) return [...items];
  reordered.splice(boundedTargetIndex, 0, moved);

  return reordered.map((item, index) => ({ ...item, sortOrder: index }));
}

/**
 * Mark an item completed at `now`. A completed item keeps its `sortOrder` — it
 * leaves the active order and is shown separately by completion time.
 */
export function markCompleted<T extends Completable>(item: T, now: number): T {
  return { ...item, completedAt: now, updatedAt: now };
}

/**
 * Reopen a completed item: clear `completedAt` and append it to the active
 * order one past the current highest (per the Active item order rule), so a gap
 * left by other completions can't slot it into the middle.
 */
export function markActive<T extends Completable>(item: T, activeItems: readonly Ordered[], now: number): T {
  return { ...item, completedAt: undefined, sortOrder: nextActiveSortOrder(activeItems), updatedAt: now };
}

/**
 * Translate a typed property-value input into the stored value fields, after
 * checking it matches the property's type (and, for select, that the option is
 * defined). Throws on a mismatch so both the Convex handler and the in-memory
 * store reject invalid values the same way.
 */
export function propertyValuePatch(
  property: { type: ListPropertyType; options?: ReadonlyArray<{ id: string }> },
  input: ListItemPropertyValueInput
): ListItemPropertyValuePatch {
  if (property.type !== input.type) throw new Error('List property value is invalid');

  switch (input.type) {
    case 'text':
      return { textValue: input.text };
    case 'number':
      return { numberValue: input.number };
    case 'date':
      return { dateValue: input.date };
    case 'checkbox':
      return { checkboxValue: input.checked };
    case 'select': {
      const optionIsValid = property.options?.some((option) => option.id === input.optionId) ?? false;
      if (!optionIsValid) throw new Error('List property option is invalid');
      return { selectOptionId: input.optionId };
    }
  }
}
