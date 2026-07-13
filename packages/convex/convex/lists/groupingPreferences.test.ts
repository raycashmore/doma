import { describe, expect, it } from 'vitest';

import { readActiveGroupingPropertyForUser, setActiveGroupingPropertyForUser } from './groupingPreferences';
import type { ListsMutationCtx } from './items';

type Row = Record<string, unknown> & { _id: string };

function createCtx(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    lists: [],
    listProperties: [],
    listGroupingPreferences: [],
    ...structuredClone(seed)
  };
  let nextId = 1;
  const allRows = () => Object.values(tables).flat();

  const ctx = {
    db: {
      get: async (id: string) => allRows().find((row) => row._id === id) ?? null,
      insert: async (table: string, row: Record<string, unknown>) => {
        const _id = `${table}_${nextId++}`;
        (tables[table] ??= []).push({ ...row, _id });
        return _id;
      },
      delete: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) rows.splice(index, 1);
        }
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        const row = allRows().find((candidate) => candidate._id === id);
        if (row) Object.assign(row, patch);
      },
      query: (table: string) => {
        const rows = () => tables[table] ?? [];
        return {
          withIndex: (_index: string, apply: (q: { eq: (field: string, value: unknown) => unknown }) => void) => {
            const eqs: Record<string, unknown> = {};
            const builder = {
              eq: (field: string, value: unknown) => {
                eqs[field] = value;
                return builder;
              }
            };
            apply(builder);
            const matches = (row: Row) => Object.entries(eqs).every(([field, value]) => row[field] === value);
            return {
              unique: async () => rows().find(matches) ?? null
            };
          }
        };
      }
    }
  };

  return { ctx: ctx as unknown as ListsMutationCtx, tables };
}

const sharedList: Row = {
  _id: 'lists_shopping',
  publicId: 'list_shopping',
  name: 'Shopping',
  slug: 'shopping',
  visibility: 'shared',
  createdByUserId: 'user_a',
  createdAt: 1,
  updatedAt: 1
};

const aisleProperty: Row = {
  _id: 'properties_aisle',
  listId: 'lists_shopping',
  name: 'Aisle',
  type: 'select',
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1
};

describe('active grouping preference', () => {
  it('stores an independent grouping selection for each household user', async () => {
    const { ctx, tables } = createCtx({ lists: [sharedList], listProperties: [aisleProperty] });

    await setActiveGroupingPropertyForUser(ctx, {
      currentUserId: 'user_a',
      listPublicId: 'list_shopping',
      propertyId: 'properties_aisle' as never
    });
    await setActiveGroupingPropertyForUser(ctx, {
      currentUserId: 'user_b',
      listPublicId: 'list_shopping',
      propertyId: 'properties_aisle' as never
    });

    await expect(
      readActiveGroupingPropertyForUser(ctx, { currentUserId: 'user_a', listPublicId: 'list_shopping' })
    ).resolves.toBe('properties_aisle');
    expect(tables.listGroupingPreferences).toHaveLength(2);
  });

  it('clears the current user’s preference when manual order is selected', async () => {
    const { ctx } = createCtx({ lists: [sharedList], listProperties: [aisleProperty] });
    await setActiveGroupingPropertyForUser(ctx, {
      currentUserId: 'user_b',
      listPublicId: 'list_shopping',
      propertyId: 'properties_aisle' as never
    });

    await setActiveGroupingPropertyForUser(ctx, {
      currentUserId: 'user_b',
      listPublicId: 'list_shopping',
      propertyId: null
    });

    await expect(
      readActiveGroupingPropertyForUser(ctx, { currentUserId: 'user_b', listPublicId: 'list_shopping' })
    ).resolves.toBeNull();
  });

  it('refuses an invisible list or a property belonging to another list', async () => {
    const privateList: Row = {
      ...sharedList,
      _id: 'lists_private',
      publicId: 'list_private',
      visibility: 'personal',
      createdByUserId: 'user_a'
    };
    const otherProperty: Row = { ...aisleProperty, _id: 'properties_other', listId: 'lists_private' };
    const { ctx } = createCtx({ lists: [sharedList, privateList], listProperties: [aisleProperty, otherProperty] });

    await expect(
      setActiveGroupingPropertyForUser(ctx, {
        currentUserId: 'user_b',
        listPublicId: 'list_private',
        propertyId: null
      })
    ).rejects.toThrow('List unavailable');
    await expect(
      setActiveGroupingPropertyForUser(ctx, {
        currentUserId: 'user_b',
        listPublicId: 'list_shopping',
        propertyId: 'properties_other' as never
      })
    ).rejects.toThrow('List property unavailable');
  });
});
