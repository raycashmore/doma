import type { Id, TableNames } from '../_generated/dataModel';

export type TestListRow = {
  _id: string;
  publicId: string;
  name: string;
  slug: string;
  visibility: 'personal' | 'shared';
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
};

export type TestListItemRow = {
  _id: string;
  listId: string;
  title: string;
  sortOrder: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type TestListPropertyRow = {
  _id: string;
  listId: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  sortOrder: number;
  options?: Array<{ id: string; label: string }>;
  createdAt: number;
  updatedAt: number;
};

export type TestListItemPropertyValueRow = {
  _id: string;
  listId: string;
  listItemId: string;
  listPropertyId: string;
  textValue?: string;
  numberValue?: number;
  dateValue?: number;
  selectOptionId?: string;
  checkboxValue?: boolean;
  createdAt: number;
  updatedAt: number;
};

export const sharedList: TestListRow = {
  _id: 'list_row_shared',
  publicId: 'list_shared',
  name: 'Shared shopping',
  slug: 'shared-shopping',
  visibility: 'shared',
  createdByUserId: 'user_a',
  createdAt: 1,
  updatedAt: 1
};

export const personalList: TestListRow = {
  _id: 'list_row_personal',
  publicId: 'list_personal',
  name: 'Weekend reset',
  slug: 'weekend-reset',
  visibility: 'personal',
  createdByUserId: 'user_a',
  createdAt: 1,
  updatedAt: 1
};

export const activeItemA: TestListItemRow = {
  _id: 'item_a',
  listId: sharedList._id,
  title: 'Bananas',
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1
};

export const activeItemB: TestListItemRow = {
  _id: 'item_b',
  listId: sharedList._id,
  title: 'Apples',
  sortOrder: 1,
  createdAt: 2,
  updatedAt: 2
};

export const completedItem: TestListItemRow = {
  _id: 'item_c',
  listId: sharedList._id,
  title: 'Coffee beans',
  sortOrder: 2,
  completedAt: 150,
  createdAt: 3,
  updatedAt: 150
};

export const priorityProperty: TestListPropertyRow = {
  _id: 'prop_priority',
  listId: sharedList._id,
  name: 'Priority',
  type: 'select',
  sortOrder: 0,
  options: [
    { id: 'opt_low', label: 'Low' },
    { id: 'opt_high', label: 'High' }
  ],
  createdAt: 1,
  updatedAt: 1
};

export const dueDateProperty: TestListPropertyRow = {
  _id: 'prop_due_date',
  listId: sharedList._id,
  name: 'Due date',
  type: 'date',
  sortOrder: 1,
  createdAt: 1,
  updatedAt: 1
};

export const notesProperty: TestListPropertyRow = {
  _id: 'prop_notes',
  listId: sharedList._id,
  name: 'Notes',
  type: 'text',
  sortOrder: 2,
  createdAt: 1,
  updatedAt: 1
};

export const quantityProperty: TestListPropertyRow = {
  _id: 'prop_quantity',
  listId: sharedList._id,
  name: 'Quantity',
  type: 'number',
  sortOrder: 3,
  createdAt: 1,
  updatedAt: 1
};

export const urgentProperty: TestListPropertyRow = {
  _id: 'prop_urgent',
  listId: sharedList._id,
  name: 'Urgent',
  type: 'checkbox',
  sortOrder: 4,
  createdAt: 1,
  updatedAt: 1
};

export const priorityValueForItemA: TestListItemPropertyValueRow = {
  _id: 'value_priority_item_a',
  listId: sharedList._id,
  listItemId: activeItemA._id,
  listPropertyId: priorityProperty._id,
  selectOptionId: 'opt_high',
  createdAt: 1,
  updatedAt: 1
};

export const dueDateValueForItemA: TestListItemPropertyValueRow = {
  _id: 'value_due_date_item_a',
  listId: sharedList._id,
  listItemId: activeItemA._id,
  listPropertyId: dueDateProperty._id,
  dateValue: 1_720_000_000_000,
  createdAt: 1,
  updatedAt: 1
};

export const priorityValueForCompletedItem: TestListItemPropertyValueRow = {
  _id: 'value_priority_item_c',
  listId: sharedList._id,
  listItemId: completedItem._id,
  listPropertyId: priorityProperty._id,
  selectOptionId: 'opt_low',
  createdAt: 1,
  updatedAt: 1
};

export const notesValueForItemA: TestListItemPropertyValueRow = {
  _id: 'value_notes_item_a',
  listId: sharedList._id,
  listItemId: activeItemA._id,
  listPropertyId: notesProperty._id,
  textValue: 'Existing notes',
  createdAt: 1,
  updatedAt: 1
};

type FutureListPropertyTableName =
  Extract<TableNames, 'listProperties'> extends never ? 'lists' : Extract<TableNames, 'listProperties'>;

export const listItemId = (value: string) => value as Id<'listItems'>;
export const listPropertyId = (value: string) => value as Id<FutureListPropertyTableName>;

type AsyncHandler = (...args: unknown[]) => Promise<unknown>;

export function getFutureHandler<THandler extends AsyncHandler>(
  moduleRecord: Record<string, unknown>,
  handlerName: string
): THandler {
  return ((...args: Parameters<THandler>) => {
    const handler = moduleRecord[handlerName];
    if (typeof handler !== 'function') {
      return Promise.reject(new Error(`${handlerName} is not implemented`));
    }

    return (handler as THandler)(...args);
  }) as THandler;
}
