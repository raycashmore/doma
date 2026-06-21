import { describe, expect, it, vi } from 'vitest';

import { type HandleListsCapabilityDeps, handleListsCapabilityRequest } from './capability';

const request = { userId: 'user_b', messageText: 'add milk and bread', receivedAt: 1 };

function deps(overrides: Partial<HandleListsCapabilityDeps> = {}): HandleListsCapabilityDeps {
  return {
    parseItems: async () => ({ targetListId: null, items: ['milk', 'bread'] }),
    loadDefaultList: async () => ({ publicId: 'list_shared', name: 'Shopping' }),
    createItems: async ({ listPublicId, titles }) => ({
      list: { publicId: listPublicId, name: 'Shopping' },
      items: titles.map((title, index) => ({ id: `item_${index}`, title }))
    }),
    ...overrides
  };
}

describe('handleListsCapabilityRequest', () => {
  it('parses, creates in the default list, and confirms what was added', async () => {
    const createItems = vi.fn(deps().createItems);

    const response = await handleListsCapabilityRequest(request, deps({ createItems }));

    expect(createItems).toHaveBeenCalledWith({
      userId: 'user_b',
      listPublicId: 'list_shared',
      titles: ['milk', 'bread']
    });
    expect(response).toEqual({
      kind: 'reply',
      text: 'Added 2 items to Shopping:\n• milk\n• bread'
    });
  });

  it('asks the user to set a default when none is configured and creates nothing', async () => {
    const createItems = vi.fn(deps().createItems);

    const response = await handleListsCapabilityRequest(
      request,
      deps({ loadDefaultList: async () => null, createItems })
    );

    expect(createItems).not.toHaveBeenCalled();
    expect(response.kind).toBe('reply');
    if (response.kind === 'reply') expect(response.text).toContain('default list');
  });

  it('degrades to an empty-parse message when nothing usable is captured', async () => {
    const createItems = vi.fn(deps().createItems);

    const response = await handleListsCapabilityRequest(
      request,
      deps({ parseItems: async () => ({ targetListId: null, items: [] }), createItems })
    );

    expect(createItems).not.toHaveBeenCalled();
    expect(response.kind).toBe('reply');
    if (response.kind === 'reply') expect(response.text).toContain("couldn't");
  });

  it('replies with a clear fallback rather than silence when a dependency throws', async () => {
    const response = await handleListsCapabilityRequest(
      request,
      deps({
        createItems: async () => {
          throw new Error('Convex down');
        }
      })
    );

    expect(response.kind).toBe('reply');
    if (response.kind === 'reply') expect(response.text.length).toBeGreaterThan(0);
  });
});
