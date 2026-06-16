export type ListItemDueTone = 'muted' | 'accent';

export type ListItemTagTone = 'sage' | 'sand' | 'butter';

export type FixtureListItem = {
  id: string;
  title: string;
  categoryId: string;
  completed: boolean;
  selected?: boolean;
  tagLabel?: string;
  tagTone?: ListItemTagTone;
  dueLabel?: string;
  dueTone?: ListItemDueTone;
};

export type FixtureCategory = {
  id: string;
  title: string;
  sourceLabel: string;
  sourceTone: 'sage' | 'sand';
  collapsed?: boolean;
  collapsedCountLabel?: string;
  items: FixtureListItem[];
};

export type FixtureListProperty = {
  label: string;
  value: string;
  accent?: boolean;
};

export type FixtureListDetail = {
  icon: 'shopping-basket' | 'house' | 'party-popper';
  title: string;
  meta: string;
  note: string;
  properties: FixtureListProperty[];
};

export const fixtureCategories: FixtureCategory[] = [
  {
    id: 'produce',
    title: 'Produce',
    sourceLabel: 'Auto',
    sourceTone: 'sage',
    items: [
      {
        id: 'item-bananas',
        title: 'Bananas',
        categoryId: 'produce',
        completed: false,
        tagLabel: 'Recurring',
        tagTone: 'butter',
        dueLabel: 'Fri 22 May',
        dueTone: 'muted'
      },
      {
        id: 'item-avocados',
        title: 'Avocados',
        categoryId: 'produce',
        completed: false,
        selected: true,
        tagLabel: 'One-off',
        tagTone: 'sand',
        dueLabel: 'Today',
        dueTone: 'accent'
      },
      {
        id: 'item-spinach',
        title: 'Baby spinach',
        categoryId: 'produce',
        completed: false,
        tagLabel: 'Recurring',
        tagTone: 'butter',
        dueLabel: 'Mon 25 May',
        dueTone: 'muted'
      }
    ]
  },
  {
    id: 'pantry',
    title: 'Pantry',
    sourceLabel: 'Manual',
    sourceTone: 'sand',
    items: [
      {
        id: 'item-sourdough',
        title: 'Sourdough loaf',
        categoryId: 'pantry',
        completed: false,
        tagLabel: 'One-off',
        tagTone: 'sand',
        dueLabel: 'Sat 23 May',
        dueTone: 'muted'
      },
      {
        id: 'item-oats',
        title: 'Rolled oats',
        categoryId: 'pantry',
        completed: false,
        tagLabel: 'Recurring',
        tagTone: 'butter',
        dueLabel: 'Fri 29 May',
        dueTone: 'muted'
      }
    ]
  },
  {
    id: 'cleaning',
    title: 'Cleaning supplies',
    sourceLabel: 'Hidden',
    sourceTone: 'sand',
    collapsed: true,
    collapsedCountLabel: '4 hidden',
    items: []
  }
];

export const selectedFixtureItem =
  fixtureCategories.flatMap((category) => category.items).find((item) => item.selected) ??
  fixtureCategories[0]?.items[0];

export const completedItems: FixtureListItem[] = [
  {
    id: 'completed-fruit',
    title: 'Restock fruit bowl',
    categoryId: 'produce',
    completed: true
  },
  {
    id: 'completed-bottles',
    title: 'Wash drink bottles',
    categoryId: 'pantry',
    completed: true
  }
];

export const selectedItemDetail: FixtureListDetail = {
  icon: 'shopping-basket',
  title: 'Avocados',
  meta: 'Produce · one-off · assigned to Maya',
  note: 'Buy firm ones if they need to last until the weekend. Auto-categorised from recipe import.',
  properties: [
    { label: 'Due', value: 'Today', accent: true },
    { label: 'Quantity', value: '4 ripe' },
    { label: 'Repeats', value: 'Never' }
  ]
};
