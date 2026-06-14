export type ListSummary = {
  id: string;
  name: string;
  visibility: 'personal' | 'shared';
  activeCount: number;
};

export type ListItem = {
  id: string;
  title: string;
  completed: boolean;
  meta: string;
};

export type ListProperty = {
  label: string;
  value: string;
};

export const lists: ListSummary[] = [
  { id: 'shared-shopping', name: 'Shared shopping', visibility: 'shared', activeCount: 4 },
  { id: 'weekend-reset', name: 'Weekend reset', visibility: 'personal', activeCount: 3 },
  { id: 'house-notes', name: 'House notes', visibility: 'shared', activeCount: 2 }
];

export const activeItems: ListItem[] = [
  { id: 'item-1', title: 'Coffee beans', completed: false, meta: 'Pantry' },
  { id: 'item-2', title: 'Book appointment', completed: false, meta: 'This week' },
  { id: 'item-3', title: 'Check lunch supplies', completed: false, meta: 'Kitchen' },
  { id: 'item-4', title: 'Replace batteries', completed: false, meta: 'Garage' }
];

export const completedItems: ListItem[] = [
  { id: 'item-5', title: 'Wash drink bottles', completed: true, meta: 'Completed today' },
  { id: 'item-6', title: 'Restock fruit bowl', completed: true, meta: 'Completed yesterday' }
];

export const selectedItemProperties: ListProperty[] = [
  { label: 'Quantity', value: '1 bag' },
  { label: 'Section', value: 'Pantry' },
  { label: 'Priority', value: 'Normal' },
  { label: 'Packed', value: 'No' }
];
