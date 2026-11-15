import type { PaprikaGroceryItem } from './api';

/** A Paprika item the person can bring into their Groceries list. */
export type PaprikaImportCandidate = { uid: string; title: string; recipe: string | null };

/**
 * Items in the person's chosen Paprika list that are still to buy: those not yet imported, and
 * those imported before but still in Paprika (removal was off or failed), which can be re-imported.
 */
export function selectImportableItems(
  items: PaprikaGroceryItem[],
  { sourceListUid, importedUids }: { sourceListUid: string | null; importedUids: string[] }
): { newItems: PaprikaGroceryItem[]; importedItems: PaprikaGroceryItem[] } {
  const imported = new Set(importedUids);
  const toBuy = items.filter((item) => item.listUid === sourceListUid && !item.purchased);
  return {
    newItems: toBuy.filter((item) => !imported.has(item.uid)),
    importedItems: toBuy.filter((item) => imported.has(item.uid))
  };
}

export function toCandidate(item: PaprikaGroceryItem): PaprikaImportCandidate {
  return { uid: item.uid, title: item.name, recipe: item.recipe };
}
