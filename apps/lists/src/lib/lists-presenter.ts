export type VisibleList = {
  _id: string;
  publicId: string;
  slug: string;
  name: string;
  visibility: 'personal' | 'shared';
  createdByUserId: string;
};

export type VisibleListItem = {
  _id: string;
  listId: string;
  title: string;
  sortOrder: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type VisibleListItemsResult = {
  list: VisibleList;
  activeItems: VisibleListItem[];
  completedItems: VisibleListItem[];
};

export type PresentedList = VisibleList & {
  description: string;
  selected: boolean;
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

const now = 1_700_000_000_000;

export const previewItemsByListPublicId: Record<string, VisibleListItemsResult> = {
  'weekly-shop': {
    list: previewVisibleLists[0]!,
    activeItems: [
      {
        _id: 'preview-item-bananas',
        listId: 'preview-weekly-shop',
        title: 'Bananas',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        _id: 'preview-item-milk',
        listId: 'preview-weekly-shop',
        title: 'Milk',
        sortOrder: 1,
        createdAt: now + 1,
        updatedAt: now + 1
      },
      {
        _id: 'preview-item-bread',
        listId: 'preview-weekly-shop',
        title: 'Bread',
        sortOrder: 2,
        createdAt: now + 2,
        updatedAt: now + 2
      }
    ],
    completedItems: [
      {
        _id: 'preview-item-apples',
        listId: 'preview-weekly-shop',
        title: 'Apples',
        sortOrder: 3,
        completedAt: now + 10,
        createdAt: now + 3,
        updatedAt: now + 10
      }
    ]
  },
  'home-reset': {
    list: previewVisibleLists[1]!,
    activeItems: [
      {
        _id: 'preview-item-laundry',
        listId: 'preview-home-reset',
        title: 'Fold laundry',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        _id: 'preview-item-bins',
        listId: 'preview-home-reset',
        title: 'Take bins out',
        sortOrder: 1,
        createdAt: now + 1,
        updatedAt: now + 1
      }
    ],
    completedItems: []
  },
  'birthday-dinner': {
    list: previewVisibleLists[2]!,
    activeItems: [
      {
        _id: 'preview-item-cake',
        listId: 'preview-birthday-dinner',
        title: 'Order cake',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      }
    ],
    completedItems: [
      {
        _id: 'preview-item-candles',
        listId: 'preview-birthday-dinner',
        title: 'Buy candles',
        sortOrder: 1,
        completedAt: now + 20,
        createdAt: now + 1,
        updatedAt: now + 20
      }
    ]
  }
};

export function presentLists(rows: VisibleList[], selectedPublicId: string | null): PresentedList[] {
  return rows.map((row) => ({
    ...row,
    description: row.visibility === 'shared' ? 'Shared list' : 'Personal list',
    selected: row.publicId === selectedPublicId
  }));
}

export function describeListMeta(
  list: Pick<VisibleList, 'visibility'> | null,
  activeCount: number,
  completedCount: number
) {
  const visibilityLabel = list?.visibility === 'shared' ? 'Shared list' : 'Personal list';
  const completedLabel = completedCount === 1 ? '1 completed' : `${completedCount} completed`;
  const activeLabel = activeCount === 1 ? '1 active item' : `${activeCount} active items`;

  return `${visibilityLabel} · ${activeLabel} · ${completedLabel}`;
}

export function projectDraggedItems(
  items: VisibleListItem[],
  draggingItemId: string | null,
  dragOverItemId: string | null
) {
  if (!draggingItemId || !dragOverItemId || draggingItemId === dragOverItemId) return items;

  const fromIndex = items.findIndex((item) => item._id === draggingItemId);
  const toIndex = items.findIndex((item) => item._id === dragOverItemId);
  if (fromIndex === -1 || toIndex === -1) return items;

  const projected = [...items];
  const [moved] = projected.splice(fromIndex, 1);
  if (!moved) return items;
  projected.splice(toIndex, 0, moved);
  return projected;
}
