import { describe, expect, it } from 'vitest';

import type { PaprikaGroceryList } from './api';
import { checkConnectionHandler, connectHandler } from './connection';

type Call = { kind: 'mutation' | 'query'; args: Record<string, unknown> };

function createCtx({ token = null as string | null, signedIn = true } = {}) {
  const calls: Call[] = [];
  const ctx = {
    auth: { getUserIdentity: async () => (signedIn ? { subject: 'user_a' } : null) },
    runMutation: async (_ref: unknown, args: Record<string, unknown>) => {
      calls.push({ kind: 'mutation', args });
      return null;
    },
    runQuery: async (_ref: unknown, args: Record<string, unknown>) => {
      calls.push({ kind: 'query', args });
      return token;
    }
  };
  return { ctx: ctx as unknown as Parameters<typeof connectHandler>[0], calls };
}

const lists: PaprikaGroceryList[] = [{ uid: 'P1', name: 'My Grocery List', isDefault: true }];
const notCalled = async (): Promise<never> => {
  throw new Error('should not be called');
};

describe('connect', () => {
  it('saves the token and lists for the signed-in person after one sign-in and one list read', async () => {
    const { ctx, calls } = createCtx();
    const tokensRead: string[] = [];
    const result = await connectHandler(
      ctx,
      { email: ' person@example.com ', password: 'pw' },
      {
        login: async ({ email }) => {
          expect(email).toBe('person@example.com');
          return { status: 'ok', token: 'token-1' };
        },
        fetchGroceryLists: async (token) => {
          tokensRead.push(token);
          return { status: 'ok', lists };
        }
      }
    );

    expect(result).toEqual({ status: 'connected' });
    expect(tokensRead).toEqual(['token-1']);
    expect(calls).toEqual([{ kind: 'mutation', args: { userId: 'user_a', token: 'token-1', groceryLists: lists } }]);
  });

  it('saves nothing when Paprika refuses the sign-in or cannot be reached', async () => {
    const refused = createCtx();
    const unreachable = createCtx();

    expect(
      await connectHandler(
        refused.ctx,
        { email: 'a', password: 'b' },
        { login: async () => ({ status: 'rejected' }), fetchGroceryLists: notCalled }
      )
    ).toEqual({ status: 'rejected' });
    expect(
      await connectHandler(
        unreachable.ctx,
        { email: 'a', password: 'b' },
        {
          login: async () => ({ status: 'ok', token: 't' }),
          fetchGroceryLists: async () => ({ status: 'unavailable' })
        }
      )
    ).toEqual({ status: 'unavailable' });
    expect([...refused.calls, ...unreachable.calls]).toEqual([]);
  });

  it('refuses a caller who is not signed in to Doma before calling Paprika', async () => {
    const { ctx } = createCtx({ signedIn: false });
    await expect(
      connectHandler(ctx, { email: 'a', password: 'b' }, { login: notCalled, fetchGroceryLists: notCalled })
    ).rejects.toThrow('Not authenticated');
  });
});

describe('checkConnection', () => {
  it('marks the connection for reconnecting when Paprika refuses the stored token', async () => {
    const { ctx, calls } = createCtx({ token: 'stale' });
    const result = await checkConnectionHandler(ctx, {
      login: notCalled,
      fetchGroceryLists: async () => ({ status: 'rejected' })
    });

    expect(result).toEqual({ status: 'rejected' });
    expect(calls.at(-1)).toEqual({ kind: 'mutation', args: { userId: 'user_a' } });
  });

  it('refreshes the lists when the token works, and changes nothing when Paprika is unreachable', async () => {
    const working = createCtx({ token: 'good' });
    expect(
      await checkConnectionHandler(working.ctx, {
        login: notCalled,
        fetchGroceryLists: async () => ({ status: 'ok', lists })
      })
    ).toEqual({ status: 'connected' });
    expect(working.calls.at(-1)).toEqual({ kind: 'mutation', args: { userId: 'user_a', groceryLists: lists } });

    const offline = createCtx({ token: 'good' });
    expect(
      await checkConnectionHandler(offline.ctx, {
        login: notCalled,
        fetchGroceryLists: async () => ({ status: 'unavailable' })
      })
    ).toEqual({ status: 'unavailable' });
    expect(offline.calls.filter((call) => call.kind === 'mutation')).toEqual([]);
  });

  it('calls Paprika only when the person is connected', async () => {
    const { ctx } = createCtx({ token: null });
    expect(await checkConnectionHandler(ctx, { login: notCalled, fetchGroceryLists: notCalled })).toEqual({
      status: 'not_connected'
    });
  });
});
