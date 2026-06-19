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
  notes?: string;
  sortOrder: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
  propertyValues: VisibleListItemPropertyValue[];
};

export type VisibleListProperty = {
  _id: string;
  listId: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  sortOrder: number;
  options?: Array<{ id: string; label: string }>;
};

export type VisibleListItemPropertyValue = {
  _id: string;
  listItemId: string;
  listPropertyId: string;
  textValue?: string;
  numberValue?: number;
  dateValue?: number;
  selectOptionId?: string;
  checkboxValue?: boolean;
};

export type VisibleListItemsResult = {
  list: VisibleList;
  properties: VisibleListProperty[];
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
    properties: [
      {
        _id: 'preview-property-priority',
        listId: 'preview-weekly-shop',
        name: 'Priority',
        type: 'select',
        sortOrder: 0,
        options: [
          { id: 'high', label: 'High' },
          { id: 'low', label: 'Low' }
        ]
      },
      {
        _id: 'preview-property-aisle',
        listId: 'preview-weekly-shop',
        name: 'Aisle',
        type: 'text',
        sortOrder: 1
      },
      {
        _id: 'preview-property-due-date',
        listId: 'preview-weekly-shop',
        name: 'Due date',
        type: 'date',
        sortOrder: 2
      }
    ],
    activeItems: [
      {
        _id: 'preview-item-bananas',
        listId: 'preview-weekly-shop',
        title: 'Bananas',
        notes: 'Buy firm ones so they last the week.',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        propertyValues: [
          {
            _id: 'preview-value-bananas-priority',
            listItemId: 'preview-item-bananas',
            listPropertyId: 'preview-property-priority',
            selectOptionId: 'high'
          }
        ]
      },
      {
        _id: 'preview-item-milk',
        listId: 'preview-weekly-shop',
        title: 'Milk',
        sortOrder: 1,
        createdAt: now + 1,
        updatedAt: now + 1,
        propertyValues: [
          {
            _id: 'preview-value-milk-aisle',
            listItemId: 'preview-item-milk',
            listPropertyId: 'preview-property-aisle',
            textValue: 'Dairy'
          }
        ]
      },
      {
        _id: 'preview-item-bread',
        listId: 'preview-weekly-shop',
        title: 'Bread',
        sortOrder: 2,
        createdAt: now + 2,
        updatedAt: now + 2,
        propertyValues: []
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
        updatedAt: now + 10,
        propertyValues: [
          {
            _id: 'preview-value-apples-due-date',
            listItemId: 'preview-item-apples',
            listPropertyId: 'preview-property-due-date',
            dateValue: now + 86_400_000
          }
        ]
      }
    ]
  },
  'home-reset': {
    list: previewVisibleLists[1]!,
    properties: [
      {
        _id: 'preview-property-area',
        listId: 'preview-home-reset',
        name: 'Area',
        type: 'text',
        sortOrder: 0
      },
      {
        _id: 'preview-property-urgent',
        listId: 'preview-home-reset',
        name: 'Urgent',
        type: 'checkbox',
        sortOrder: 1
      }
    ],
    activeItems: [
      {
        _id: 'preview-item-laundry',
        listId: 'preview-home-reset',
        title: 'Fold laundry',
        notes: 'Sort darks and lights before folding.',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        propertyValues: [
          {
            _id: 'preview-value-laundry-area',
            listItemId: 'preview-item-laundry',
            listPropertyId: 'preview-property-area',
            textValue: 'Bedroom'
          }
        ]
      },
      {
        _id: 'preview-item-bins',
        listId: 'preview-home-reset',
        title: 'Take bins out',
        sortOrder: 1,
        createdAt: now + 1,
        updatedAt: now + 1,
        propertyValues: [
          {
            _id: 'preview-value-bins-urgent',
            listItemId: 'preview-item-bins',
            listPropertyId: 'preview-property-urgent',
            checkboxValue: true
          }
        ]
      }
    ],
    completedItems: []
  },
  'birthday-dinner': {
    list: previewVisibleLists[2]!,
    properties: [
      {
        _id: 'preview-property-owner',
        listId: 'preview-birthday-dinner',
        name: 'Owner',
        type: 'text',
        sortOrder: 0
      },
      {
        _id: 'preview-property-budget',
        listId: 'preview-birthday-dinner',
        name: 'Budget',
        type: 'number',
        sortOrder: 1
      }
    ],
    activeItems: [
      {
        _id: 'preview-item-cake',
        listId: 'preview-birthday-dinner',
        title: 'Order cake',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        propertyValues: [
          {
            _id: 'preview-value-cake-owner',
            listItemId: 'preview-item-cake',
            listPropertyId: 'preview-property-owner',
            textValue: 'memberA'
          },
          {
            _id: 'preview-value-cake-budget',
            listItemId: 'preview-item-cake',
            listPropertyId: 'preview-property-budget',
            numberValue: 85
          }
        ]
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
        updatedAt: now + 20,
        propertyValues: []
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

export function getSelectedItem(
  activeItems: VisibleListItem[],
  completedItems: VisibleListItem[],
  selectedItemId: string | null
) {
  if (!selectedItemId) return null;
  return [...activeItems, ...completedItems].find((item) => item._id === selectedItemId) ?? null;
}
