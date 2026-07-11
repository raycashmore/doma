import type { VisibleListItem, VisibleListProperty } from './presenter';

export type ActiveItemGroup = {
  key: string;
  label: string;
  isUnassigned: boolean;
  items: VisibleListItem[];
};

function sortByManualOrder(items: VisibleListItem[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt - right.createdAt);
}

function localDayKey(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return null;
  const year = `${date.getFullYear()}`.padStart(4, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Presents active list items in the stable groups supplied by one list
 * property. Missing and invalid values stay visible in the final Unassigned
 * group instead of becoming an invisible filtering side-effect.
 */
export function groupActiveItemsByProperty({
  property,
  items
}: {
  property: VisibleListProperty;
  items: VisibleListItem[];
}): ActiveItemGroup[] {
  if (property.type === 'text') {
    const itemsByText = new Map<string, { label: string; items: VisibleListItem[] }>();
    const unassignedItems: VisibleListItem[] = [];

    for (const item of sortByManualOrder(items)) {
      const textValue = item.propertyValues.find((value) => value.listPropertyId === property._id)?.textValue?.trim();
      if (!textValue) {
        unassignedItems.push(item);
        continue;
      }

      const key = textValue.toLocaleLowerCase();
      const group = itemsByText.get(key);
      if (group) group.items.push(item);
      else itemsByText.set(key, { label: textValue, items: [item] });
    }

    const assignedGroups = [...itemsByText.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, group]) => ({ key: `text:${key}`, label: group.label, isUnassigned: false, items: group.items }));

    return unassignedItems.length
      ? [...assignedGroups, { key: 'unassigned', label: 'Unassigned', isUnassigned: true, items: unassignedItems }]
      : assignedGroups;
  }

  if (property.type === 'number') {
    const itemsByNumber = new Map<number, VisibleListItem[]>();
    const unassignedItems: VisibleListItem[] = [];

    for (const item of sortByManualOrder(items)) {
      const numberValue = item.propertyValues.find((value) => value.listPropertyId === property._id)?.numberValue;
      if (numberValue === undefined) {
        unassignedItems.push(item);
        continue;
      }

      const groupItems = itemsByNumber.get(numberValue);
      if (groupItems) groupItems.push(item);
      else itemsByNumber.set(numberValue, [item]);
    }

    const assignedGroups = [...itemsByNumber.entries()]
      .sort(([left], [right]) => left - right)
      .map(([value, groupItems]) => ({
        key: `number:${value}`,
        label: `${value}`,
        isUnassigned: false,
        items: groupItems
      }));

    return unassignedItems.length
      ? [...assignedGroups, { key: 'unassigned', label: 'Unassigned', isUnassigned: true, items: unassignedItems }]
      : assignedGroups;
  }

  if (property.type === 'date') {
    const itemsByDay = new Map<string, VisibleListItem[]>();
    const unassignedItems: VisibleListItem[] = [];

    for (const item of sortByManualOrder(items)) {
      const dateValue = item.propertyValues.find((value) => value.listPropertyId === property._id)?.dateValue;
      const day = dateValue === undefined ? null : localDayKey(dateValue);
      if (!day) {
        unassignedItems.push(item);
        continue;
      }

      const groupItems = itemsByDay.get(day);
      if (groupItems) groupItems.push(item);
      else itemsByDay.set(day, [item]);
    }

    const assignedGroups = [...itemsByDay.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([day, groupItems]) => ({ key: `date:${day}`, label: day, isUnassigned: false, items: groupItems }));

    return unassignedItems.length
      ? [...assignedGroups, { key: 'unassigned', label: 'Unassigned', isUnassigned: true, items: unassignedItems }]
      : assignedGroups;
  }

  if (property.type === 'checkbox') {
    const checkedItems: VisibleListItem[] = [];
    const uncheckedItems: VisibleListItem[] = [];
    const unassignedItems: VisibleListItem[] = [];

    for (const item of sortByManualOrder(items)) {
      const checkboxValue = item.propertyValues.find((value) => value.listPropertyId === property._id)?.checkboxValue;
      if (checkboxValue === true) checkedItems.push(item);
      else if (checkboxValue === false) uncheckedItems.push(item);
      else unassignedItems.push(item);
    }

    const assignedGroups: ActiveItemGroup[] = [];
    if (checkedItems.length)
      assignedGroups.push({ key: 'checkbox:true', label: 'Yes', isUnassigned: false, items: checkedItems });
    if (uncheckedItems.length)
      assignedGroups.push({ key: 'checkbox:false', label: 'No', isUnassigned: false, items: uncheckedItems });

    return unassignedItems.length
      ? [...assignedGroups, { key: 'unassigned', label: 'Unassigned', isUnassigned: true, items: unassignedItems }]
      : assignedGroups;
  }

  if (property.type !== 'select') return [];

  const itemsByOptionId = new Map((property.options ?? []).map((option) => [option.id, [] as VisibleListItem[]]));
  const unassignedItems: VisibleListItem[] = [];

  for (const item of sortByManualOrder(items)) {
    const optionId = item.propertyValues.find((value) => value.listPropertyId === property._id)?.selectOptionId;
    const groupItems = optionId ? itemsByOptionId.get(optionId) : undefined;
    if (groupItems) groupItems.push(item);
    else unassignedItems.push(item);
  }

  const assignedGroups = (property.options ?? []).flatMap((option) => {
    const groupItems = itemsByOptionId.get(option.id) ?? [];
    return groupItems.length
      ? [{ key: `select:${option.id}`, label: option.label, isUnassigned: false, items: groupItems }]
      : [];
  });

  return unassignedItems.length
    ? [...assignedGroups, { key: 'unassigned', label: 'Unassigned', isUnassigned: true, items: unassignedItems }]
    : assignedGroups;
}
