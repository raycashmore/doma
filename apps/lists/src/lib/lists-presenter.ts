import {
  completedItems,
  fixtureCategories,
  type FixtureCategory,
  type FixtureListDetail,
  type FixtureListItem,
  selectedFixtureItem,
  selectedItemDetail} from '$lib/lists-fixtures';

export type VisibleList = {
  _id: string;
  publicId: string;
  slug: string;
  name: string;
  visibility: 'personal' | 'shared';
  createdByUserId: string;
};

export type PresentedList = VisibleList & {
  description: string;
  icon: 'shopping-basket' | 'house' | 'party-popper';
  itemCountLabel: string;
  selected: boolean;
};

export type PresentedListScreen = {
  categories: FixtureCategory[];
  completedItems: FixtureListItem[];
  detail: FixtureListDetail;
  metaLabel: string;
  selectedItem: FixtureListItem;
  title: string;
};

export const previewVisibleLists: VisibleList[] = [
  {
    _id: 'preview-weekly-shop',
    publicId: 'weekly-shop',
    slug: 'weekly-shop',
    name: 'Weekly shop',
    visibility: 'shared',
    createdByUserId: 'preview-user'
  },
  {
    _id: 'preview-home-reset',
    publicId: 'home-reset',
    slug: 'home-reset',
    name: 'Home reset',
    visibility: 'personal',
    createdByUserId: 'preview-user'
  },
  {
    _id: 'preview-birthday-dinner',
    publicId: 'birthday-dinner',
    slug: 'birthday-dinner',
    name: 'Birthday dinner',
    visibility: 'shared',
    createdByUserId: 'preview-user'
  }
];

const listDecor = [
  {
    icon: 'shopping-basket' as const,
    description: 'Shared with Maya and Jon · Due Fri',
    itemCountLabel: '18 items'
  },
  {
    icon: 'house' as const,
    description: 'Personal · 2 overdue',
    itemCountLabel: '8 items'
  },
  {
    icon: 'party-popper' as const,
    description: 'Shared · One-off',
    itemCountLabel: '6 items'
  }
];

export function presentLists(rows: VisibleList[], selectedPublicId: string | null): PresentedList[] {
  return rows.map((row, index) => {
    const decor = listDecor[index % listDecor.length] ?? listDecor[0]!;

    return {
      ...row,
      ...decor,
      selected: row.publicId === selectedPublicId
    };
  });
}

export function presentListScreen(selectedList: PresentedList | null): PresentedListScreen {
  const title = selectedList?.name ?? 'Weekly shop';
  const metaLabel = selectedList
    ? selectedList.visibility === 'shared'
      ? `Shared with Maya and Jon · ${selectedList.itemCountLabel}`
      : `${selectedList.description} · ${selectedList.itemCountLabel}`
    : 'Shared with Maya and Jon · 18 items';

  return {
    categories: fixtureCategories,
    completedItems,
    detail: selectedItemDetail,
    metaLabel,
    selectedItem: selectedFixtureItem ?? {
      id: 'fallback-item',
      title: 'Coffee beans',
      categoryId: 'pantry',
      completed: false
    },
    title
  };
}
