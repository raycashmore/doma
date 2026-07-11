import { describe, expect, it } from 'vitest';

import { groupActiveItemsByProperty } from './grouping';
import type { VisibleListItem, VisibleListProperty } from './presenter';

const property: VisibleListProperty = {
  _id: 'property-section',
  listId: 'list-shop',
  name: 'Store section',
  type: 'select',
  sortOrder: 0,
  options: [
    { id: 'produce', label: 'Produce' },
    { id: 'bakery', label: 'Bakery' }
  ]
};

function item(id: string, title: string, sortOrder: number, selectOptionId?: string): VisibleListItem {
  return {
    _id: id,
    listId: 'list-shop',
    title,
    sortOrder,
    createdAt: sortOrder,
    updatedAt: sortOrder,
    propertyValues: selectOptionId
      ? [{ _id: `value-${id}`, listItemId: id, listPropertyId: property._id, selectOptionId }]
      : []
  };
}

describe('groupActiveItemsByProperty', () => {
  it('uses select option order, keeps manual order within groups, and puts unassigned items last', () => {
    const groups = groupActiveItemsByProperty({
      property,
      items: [
        item('milk', 'Milk', 0, 'bakery'),
        item('carrots', 'Carrots', 1, 'produce'),
        item('bananas', 'Bananas', 2, 'produce'),
        item('batteries', 'Batteries', 3)
      ]
    });

    expect(groups.map((group) => [group.label, group.items.map((entry) => entry.title)])).toEqual([
      ['Produce', ['Carrots', 'Bananas']],
      ['Bakery', ['Milk']],
      ['Unassigned', ['Batteries']]
    ]);
  });

  it('normalizes text values into alphabetic groups without changing item order within a group', () => {
    const textProperty: VisibleListProperty = {
      _id: 'property-area',
      listId: 'list-shop',
      name: 'Area',
      type: 'text',
      sortOrder: 0
    };
    const textItem = (id: string, title: string, sortOrder: number, textValue?: string): VisibleListItem => ({
      ...item(id, title, sortOrder),
      propertyValues: textValue
        ? [{ _id: `value-${id}`, listItemId: id, listPropertyId: textProperty._id, textValue }]
        : []
    });

    const groups = groupActiveItemsByProperty({
      property: textProperty,
      items: [
        textItem('tea', 'Tea', 0, 'Pantry'),
        textItem('milk', 'Milk', 1, 'dairy'),
        textItem('yoghurt', 'Yoghurt', 2, ' Dairy '),
        textItem('batteries', 'Batteries', 3)
      ]
    });

    expect(groups.map((group) => [group.label, group.items.map((entry) => entry.title)])).toEqual([
      ['dairy', ['Milk', 'Yoghurt']],
      ['Pantry', ['Tea']],
      ['Unassigned', ['Batteries']]
    ]);
  });

  it('sorts number groups by exact numeric value and keeps missing values unassigned', () => {
    const numberProperty: VisibleListProperty = {
      _id: 'property-quantity',
      listId: 'list-shop',
      name: 'Quantity',
      type: 'number',
      sortOrder: 0
    };
    const numberItem = (id: string, title: string, sortOrder: number, numberValue?: number): VisibleListItem => ({
      ...item(id, title, sortOrder),
      propertyValues:
        numberValue === undefined
          ? []
          : [{ _id: `value-${id}`, listItemId: id, listPropertyId: numberProperty._id, numberValue }]
    });

    const groups = groupActiveItemsByProperty({
      property: numberProperty,
      items: [
        numberItem('bananas', 'Bananas', 0, 2),
        numberItem('apples', 'Apples', 1, 1),
        numberItem('bread', 'Bread', 2)
      ]
    });

    expect(groups.map((group) => [group.label, group.items.map((entry) => entry.title)])).toEqual([
      ['1', ['Apples']],
      ['2', ['Bananas']],
      ['Unassigned', ['Bread']]
    ]);
  });

  it('groups dates by local calendar day in chronological order', () => {
    const dateProperty: VisibleListProperty = {
      _id: 'property-date',
      listId: 'list-shop',
      name: 'Needed by',
      type: 'date',
      sortOrder: 0
    };
    const early = new Date(2026, 6, 11, 12).valueOf();
    const late = new Date(2026, 6, 12, 12).valueOf();
    const dateItem = (id: string, title: string, sortOrder: number, dateValue?: number): VisibleListItem => ({
      ...item(id, title, sortOrder),
      propertyValues: dateValue
        ? [{ _id: `value-${id}`, listItemId: id, listPropertyId: dateProperty._id, dateValue }]
        : []
    });

    const groups = groupActiveItemsByProperty({
      property: dateProperty,
      items: [
        dateItem('late-item', 'Later item', 0, late),
        dateItem('early-item', 'Early item', 1, early),
        dateItem('same-day-item', 'Same-day item', 2, early),
        dateItem('no-date', 'No date', 3)
      ]
    });

    expect(groups.map((group) => [group.label, group.items.map((entry) => entry.title)])).toEqual([
      ['2026-07-11', ['Early item', 'Same-day item']],
      ['2026-07-12', ['Later item']],
      ['Unassigned', ['No date']]
    ]);
  });

  it('keeps explicit checkbox values separate from unassigned items', () => {
    const checkboxProperty: VisibleListProperty = {
      _id: 'property-urgent',
      listId: 'list-shop',
      name: 'Urgent',
      type: 'checkbox',
      sortOrder: 0
    };
    const checkboxItem = (id: string, title: string, sortOrder: number, checkboxValue?: boolean): VisibleListItem => ({
      ...item(id, title, sortOrder),
      propertyValues:
        checkboxValue === undefined
          ? []
          : [{ _id: `value-${id}`, listItemId: id, listPropertyId: checkboxProperty._id, checkboxValue }]
    });

    const groups = groupActiveItemsByProperty({
      property: checkboxProperty,
      items: [
        checkboxItem('ordinary', 'Ordinary', 0, false),
        checkboxItem('urgent', 'Urgent', 1, true),
        checkboxItem('unknown', 'Unknown', 2)
      ]
    });

    expect(groups.map((group) => [group.label, group.items.map((entry) => entry.title)])).toEqual([
      ['Yes', ['Urgent']],
      ['No', ['Ordinary']],
      ['Unassigned', ['Unknown']]
    ]);
  });
});
