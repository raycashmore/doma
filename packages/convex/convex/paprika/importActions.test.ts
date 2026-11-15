import { describe, expect, it } from 'vitest';

import type { PaprikaGroceryItem } from './api';
import { importItemsHandler, previewImportHandler } from './importActions';
import type { PaprikaImportCandidate } from './importSelection';

type Call = { kind: 'mutation' | 'query'; args: Record<string, unknown> };

function item(uid: string, recipe: string | null = null, listUid = 'P1'): PaprikaGroceryItem {
  return { uid, listUid, name: `${uid} line`, recipe, purchased: false, raw: { uid, list_uid: listUid } };
}

/** A fake action context: the token, the already-imported uids, and what recording an import returns. */
function createCtx({ token = 'token-1' as string | null, importedUids = [] as string[], groceriesList = true } = {}) {
  // `groceriesList: false` stands for a person with no Groceries list.
  const calls: Call[] = [];
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: 'user_a' }) },
    runQuery: async (_ref: unknown, args: Record<string, unknown>) => {
      calls.push({ kind: 'query', args });
      if ('uids' in args) return { sourceListUid: 'P1', importedUids, hasGroceriesList: groceriesList };
      return token;
    },
    runMutation: async (_ref: unknown, args: Record<string, unknown>) => {
      calls.push({ kind: 'mutation', args });
      if (!('items' in args)) return null;
      if (!groceriesList) return { status: 'no_groceries_list' };
      const items = args.items as PaprikaImportCandidate[];
      return { status: 'imported', importedUids: items.map((candidate) => candidate.uid), listName: 'Shopping list' };
    }
  };
  return { ctx: ctx as unknown as Parameters<typeof previewImportHandler>[0], calls };
}

const groceries = async () => ({ status: 'ok' as const, items: [item('G1', 'Spinach pie'), item('G2'), item('G3')] });

const notCalled = async (): Promise<never> => {
  throw new Error('should not be called');
};

describe('previewImport', () => {
  it('shows the chosen list’s items not yet imported, after one read of Paprika', async () => {
    const { ctx } = createCtx({ importedUids: ['G2'] });
    let reads = 0;
    const result = await previewImportHandler(ctx, {
      fetchGroceries: async () => {
        reads += 1;
        return { status: 'ok', items: [item('G1', 'Spinach pie'), item('G2'), item('G3', null, 'P2')] };
      },
      deleteGroceries: notCalled
    });

    expect(result).toEqual({ status: 'ok', items: [{ uid: 'G1', title: 'G1 line', recipe: 'Spinach pie' }] });
    expect(reads).toBe(1);
  });

  it('marks the connection for reconnect when Paprika refuses the token', async () => {
    const { ctx, calls } = createCtx();
    const result = await previewImportHandler(ctx, {
      fetchGroceries: async () => ({ status: 'rejected', reason: 'Unauthorized' }),
      deleteGroceries: notCalled
    });

    expect(result).toEqual({ status: 'rejected', reason: 'Unauthorized' });
    expect(calls).toContainEqual({ kind: 'mutation', args: { userId: 'user_a' } });
  });

  it('tells the person to choose a Groceries list before showing items', async () => {
    const { ctx } = createCtx({ groceriesList: false });
    expect(await previewImportHandler(ctx, { fetchGroceries: groceries, deleteGroceries: notCalled })).toEqual({
      status: 'no_groceries_list'
    });
  });

  it('does not call Paprika when the person has not connected', async () => {
    const { ctx } = createCtx({ token: null });
    expect(await previewImportHandler(ctx, { fetchGroceries: notCalled, deleteGroceries: notCalled })).toEqual({
      status: 'not_connected'
    });
  });
});

describe('importItems', () => {
  it('imports only the ticked items, then removes exactly those from Paprika', async () => {
    const { ctx, calls } = createCtx();
    const removed: string[] = [];
    const result = await importItemsHandler(
      ctx,
      { uids: ['G1', 'G3', 'GONE'], removeFromPaprika: true },
      {
        fetchGroceries: groceries,
        deleteGroceries: async (token, items) => {
          expect(token).toBe('token-1');
          removed.push(...items.map((candidate) => candidate.uid));
          return { status: 'ok' };
        }
      }
    );

    expect(result).toEqual({ status: 'imported', count: 2, listName: 'Shopping list', removal: 'removed' });
    expect(removed).toEqual(['G1', 'G3']);
    expect(calls).toContainEqual({
      kind: 'mutation',
      args: {
        userId: 'user_a',
        items: [
          { uid: 'G1', title: 'G1 line', recipe: 'Spinach pie' },
          { uid: 'G3', title: 'G3 line', recipe: null }
        ]
      }
    });
  });

  it('keeps the imported items and reports a partial result when removing them from Paprika fails', async () => {
    const { ctx } = createCtx();
    const result = await importItemsHandler(
      ctx,
      { uids: ['G1'], removeFromPaprika: true },
      { fetchGroceries: groceries, deleteGroceries: async () => ({ status: 'unavailable', httpStatus: 500 }) }
    );
    expect(result).toEqual({ status: 'imported', count: 1, listName: 'Shopping list', removal: 'failed' });
  });

  it('leaves Paprika alone when the person turns removal off', async () => {
    const { ctx } = createCtx();
    const result = await importItemsHandler(
      ctx,
      { uids: ['G1'], removeFromPaprika: false },
      { fetchGroceries: groceries, deleteGroceries: notCalled }
    );
    expect(result).toEqual({ status: 'imported', count: 1, listName: 'Shopping list', removal: 'kept' });
  });

  it('changes nothing when Paprika cannot be reached', async () => {
    const { ctx, calls } = createCtx();
    const result = await importItemsHandler(
      ctx,
      { uids: ['G1'], removeFromPaprika: true },
      { fetchGroceries: async () => ({ status: 'unavailable', httpStatus: null }), deleteGroceries: notCalled }
    );
    expect(result).toEqual({ status: 'unavailable', httpStatus: null });
    expect(calls.filter((call) => call.kind === 'mutation')).toEqual([]);
  });

  it('marks the connection for reconnect when Paprika refuses the removal', async () => {
    const { ctx, calls } = createCtx();
    const result = await importItemsHandler(
      ctx,
      { uids: ['G1'], removeFromPaprika: true },
      { fetchGroceries: groceries, deleteGroceries: async () => ({ status: 'rejected', reason: null }) }
    );
    expect(result).toEqual({ status: 'imported', count: 1, listName: 'Shopping list', removal: 'failed' });
    expect(calls).toContainEqual({ kind: 'mutation', args: { userId: 'user_a' } });
  });

  it('removes nothing from Paprika when there is no Groceries list to import into', async () => {
    const { ctx } = createCtx({ groceriesList: false });
    const result = await importItemsHandler(
      ctx,
      { uids: ['G1'], removeFromPaprika: true },
      { fetchGroceries: groceries, deleteGroceries: notCalled }
    );
    expect(result).toEqual({ status: 'no_groceries_list' });
  });
});
