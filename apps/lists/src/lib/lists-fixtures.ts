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
