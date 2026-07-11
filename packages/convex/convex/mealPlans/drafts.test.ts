import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyLatestMealPlanDraftForUser, saveMealPlanDraftForUser } from './drafts';

type Row = Record<string, unknown> & { _id: string };

function createCtx(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    lists: [
      {
        _id: 'lists_shopping',
        publicId: 'list_shopping',
        name: 'Shopping',
        slug: 'shopping',
        visibility: 'shared',
        createdByUserId: 'user_123',
        createdAt: 1,
        updatedAt: 1
      }
    ],
    listItems: [],
    mealPlanDrafts: [],
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
      patch: async (id: string, patch: Record<string, unknown>) => {
        const row = allRows().find((candidate) => candidate._id === id);
        if (row) Object.assign(row, patch);
      },
      query: (table: string) => {
        const rows = () => tables[table] ?? [];
        return {
          withIndex: (_index: string, apply: (q: { eq: (field: string, value: unknown) => unknown }) => void) => {
            const equals: Record<string, unknown> = {};
            const builder = {
              eq: (field: string, value: unknown) => {
                equals[field] = value;
                return builder;
              }
            };
            apply(builder);
            const matching = () =>
              rows().filter((row) => Object.entries(equals).every(([field, value]) => row[field] === value));
            return { collect: async () => matching(), unique: async () => matching()[0] ?? null };
          },
          collect: async () => rows()
        };
      }
    }
  };

  return { ctx: ctx as never, tables };
}

afterEach(() => vi.restoreAllMocks());

describe('meal-plan drafts', () => {
  it('applies the latest unexpired draft once and confirms only its created titles', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const { ctx, tables } = createCtx({
      listItems: [
        {
          _id: 'listItems_existing',
          listId: 'lists_shopping',
          title: 'generic ingredient',
          sortOrder: 0,
          createdAt: 1,
          updatedAt: 1
        }
      ]
    });
    await saveMealPlanDraftForUser(ctx, {
      currentUserId: 'user_123',
      providerChatId: 'telegram_chat',
      shoppingListPublicId: 'list_shopping',
      ingredientTitles: ['generic ingredient', 'other ingredient']
    });

    await expect(
      applyLatestMealPlanDraftForUser(ctx, { currentUserId: 'user_123', providerChatId: 'telegram_chat' })
    ).resolves.toEqual({
      kind: 'applied',
      createdTitles: ['other ingredient'],
      listName: 'Shopping'
    });
    await expect(
      applyLatestMealPlanDraftForUser(ctx, { currentUserId: 'user_123', providerChatId: 'telegram_chat' })
    ).resolves.toEqual({ kind: 'already_applied' });
    expect(tables.listItems!.map((item) => item.title)).toEqual(['generic ingredient', 'other ingredient']);
  });

  it("does not apply an expired or another chat user's draft", async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const { ctx, tables } = createCtx();
    await saveMealPlanDraftForUser(ctx, {
      currentUserId: 'user_123',
      providerChatId: 'telegram_chat',
      shoppingListPublicId: 'list_shopping',
      ingredientTitles: ['generic ingredient']
    });
    vi.spyOn(Date, 'now').mockReturnValue(1_000 + 30 * 60 * 1_000 + 1);

    await expect(
      applyLatestMealPlanDraftForUser(ctx, { currentUserId: 'user_123', providerChatId: 'telegram_chat' })
    ).resolves.toEqual({ kind: 'expired' });
    await expect(
      applyLatestMealPlanDraftForUser(ctx, { currentUserId: 'other_user', providerChatId: 'telegram_chat' })
    ).resolves.toEqual({ kind: 'missing' });
    expect(tables.listItems).toEqual([]);
  });
});
