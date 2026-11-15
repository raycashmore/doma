import type { PaprikaGroceryItem } from './api';

/** A Paprika item the person can bring into their Groceries list. */
export type PaprikaImportCandidate = { uid: string; title: string; recipe: string | null };

/** Items in the person's chosen Paprika list that are still to buy and have not been imported. */
export function selectImportableItems(
  items: PaprikaGroceryItem[],
  { sourceListUid, importedUids }: { sourceListUid: string | null; importedUids: string[] }
): PaprikaGroceryItem[] {
  const imported = new Set(importedUids);
  return items.filter((item) => item.listUid === sourceListUid && !item.purchased && !imported.has(item.uid));
}

export function toCandidate(item: PaprikaGroceryItem): PaprikaImportCandidate {
  return { uid: item.uid, title: item.name, recipe: item.recipe };
}
