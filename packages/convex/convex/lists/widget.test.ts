import { describe, expect, it } from 'vitest';

import { readWidgetSnapshot } from './widget';

const sharedList = {
  _id: 'list_shared',
  publicId: 'list_shared',
  name: 'Shared errands',
  slug: 'shared-errands',
  visibility: 'shared' as const,
  createdByUserId: 'user_a',
  createdAt: 1,
  updatedAt: 1
};

const personalList = {
  ...sharedList,
  _id: 'list_personal',
  publicId: 'list_personal',
  name: 'Private reset',
  slug: 'private-reset',
  visibility: 'personal' as const
};

const listItems = [
  {
    _id: 'item_second',
    listId: 'list_shared',
    title: 'Second item',
    notes: 'not for the widget',
    sortOrder: 2,
    createdAt: 2,
    updatedAt: 2
  },
  {
    _id: 'item_first',
    listId: 'list_shared',
    title: 'First item',
    sortOrder: 1,
    createdAt: 1,
    updatedAt: 1
  },
  {
    _id: 'item_complete',
    listId: 'list_shared',
    title: 'Completed item',
    sortOrder: 0,
    completedAt: 3,
    createdAt: 0,
    updatedAt: 3
  }
];

function createQueryCtx(identity: { subject: string } | null, lists = [sharedList, personalList]) {
  return {
    auth: {
      getUserIdentity: async () => identity
    },
    db: {
      query: (table: string) => {
        if (table === 'lists') {
          return {
            withIndex: (
              _index: string,
              apply: (query: { eq: (field: string, value: string) => unknown }) => unknown
            ) => {
              let publicId = '';
              apply({
                eq: (_field, value) => {
                  publicId = value;
                  return value;
                }
              });
              return { unique: async () => lists.find((list) => list.publicId === publicId) ?? null };
            }
          };
        }

        if (table === 'listItems') {
          return {
            withIndex: (
              _index: string,
              apply: (query: { eq: (field: string, value: string) => unknown }) => unknown
            ) => {
              let listId = '';
              apply({
                eq: (_field, value) => {
                  listId = value;
                  return value;
                }
              });
              return { collect: async () => listItems.filter((item) => item.listId === listId) };
            }
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }
    }
  };
}

describe('readWidgetSnapshot', () => {
  it('returns only active titles in manual order with the minimal list projection', async () => {
    await expect(
      readWidgetSnapshot(createQueryCtx({ subject: 'user_b' }) as never, { publicId: 'list_shared' })
    ).resolves.toEqual({
      list: {
        publicId: 'list_shared',
        name: 'Shared errands',
        slug: 'shared-errands'
      },
      activeItems: [
        { id: 'item_first', title: 'First item' },
        { id: 'item_second', title: 'Second item' }
      ]
    });
  });

  it('returns null for a list the caller cannot see', async () => {
    await expect(
      readWidgetSnapshot(createQueryCtx({ subject: 'user_b' }) as never, { publicId: 'list_personal' })
    ).resolves.toBeNull();
  });

  it('returns null for a missing list', async () => {
    await expect(
      readWidgetSnapshot(createQueryCtx({ subject: 'user_a' }) as never, { publicId: 'list_missing' })
    ).resolves.toBeNull();
  });
});
