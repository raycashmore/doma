import { describe, expect, it, vi } from 'vitest';

import { type HandleListsCapabilityDeps, handleListsCapabilityRequest } from './capability';

const request = { userId: 'user_b', messageText: 'add milk and bread', receivedAt: 1 };

const addressableLists = [
  { id: 'list_shared', name: 'Shopping' },
  { id: 'list_garden', name: 'Garden' }
];

function deps(overrides: Partial<HandleListsCapabilityDeps> = {}): HandleListsCapabilityDeps {
  return {
    loadAddressableContext: async () => ({
      lists: addressableLists,
      defaultList: { publicId: 'list_shared', name: 'Shopping' }
    }),
    parseItems: async () => ({ targetListId: null, items: ['milk', 'bread'] }),
    createItems: async ({ listPublicId, titles }) => ({
      list: { publicId: listPublicId, name: nameFor(listPublicId) },
      items: titles.map((title, index) => ({ id: `item_${index}`, title }))
    }),
    ...overrides
  };
}

function nameFor(publicId: string): string {
  return addressableLists.find((list) => list.id === publicId)?.name ?? 'Shopping';
}

describe('handleListsCapabilityRequest', () => {
  it('hands the addressable lists and default to the parser', async () => {
    const parseItems = vi.fn(deps().parseItems);

    await handleListsCapabilityRequest(request, deps({ parseItems }));

    expect(parseItems).toHaveBeenCalledWith({
      messageText: 'add milk and bread',
      addressableLists,
      defaultListId: 'list_shared'
    });
  });

  it('parses, creates in the default list when no list is named, and confirms', async () => {
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

  it('creates in the named list when the parser resolves one among the addressable lists', async () => {
    const createItems = vi.fn(deps().createItems);

    const response = await handleListsCapabilityRequest(
      request,
      deps({
        parseItems: async () => ({ targetListId: 'list_garden', items: ['compost'] }),
        createItems
      })
    );

    expect(createItems).toHaveBeenCalledWith({
      userId: 'user_b',
      listPublicId: 'list_garden',
      titles: ['compost']
    });
    expect(response).toEqual({
      kind: 'reply',
      text: 'Added 1 item to Garden:\n• compost'
    });
  });

  it('falls back to the default list and says so when the named list cannot be resolved', async () => {
    const createItems = vi.fn(deps().createItems);

    const response = await handleListsCapabilityRequest(
      request,
      deps({
        // Parser reports a list was named (requestedListName) but no id resolved.
        parseItems: async () => ({ targetListId: null, requestedListName: 'patio', items: ['gravel'] }),
        createItems
      })
    );

    expect(createItems).toHaveBeenCalledWith({
      userId: 'user_b',
      listPublicId: 'list_shared',
      titles: ['gravel']
    });
    expect(response.kind).toBe('reply');
    if (response.kind === 'reply') {
      expect(response.text).toContain("couldn't find 'patio'");
      expect(response.text).toContain('Shopping');
      expect(response.text).toContain('• gravel');
    }
  });

  it('falls back to the default with a generic explanation when the parser is unresolved without a name', async () => {
    const createItems = vi.fn(deps().createItems);

    const response = await handleListsCapabilityRequest(
      request,
      deps({
        // Unresolved-target state with no trustworthy requested name (e.g. the
        // model returned an invalid non-null id). Key is present, value is null.
        parseItems: async () => ({ targetListId: null, requestedListName: null, items: ['gravel'] }),
        createItems
      })
    );

    expect(createItems).toHaveBeenCalledWith({
      userId: 'user_b',
      listPublicId: 'list_shared',
      titles: ['gravel']
    });
    expect(response.kind).toBe('reply');
    if (response.kind === 'reply') {
      expect(response.text).not.toContain("couldn't find '");
      expect(response.text).toContain('Shopping');
      expect(response.text).toContain('your default');
      expect(response.text).toContain('• gravel');
    }
  });

  it('asks the user to set a default when none is configured and no list resolves, creating nothing', async () => {
    const createItems = vi.fn(deps().createItems);

    const response = await handleListsCapabilityRequest(
      request,
      deps({
        loadAddressableContext: async () => ({ lists: addressableLists, defaultList: null }),
        parseItems: async () => ({ targetListId: null, requestedListName: 'patio', items: ['gravel'] }),
        createItems
      })
    );

    expect(createItems).not.toHaveBeenCalled();
    expect(response.kind).toBe('reply');
    if (response.kind === 'reply') expect(response.text).toContain('default list');
  });

  it('creates in a named list even when no default is set', async () => {
    const createItems = vi.fn(deps().createItems);

    const response = await handleListsCapabilityRequest(
      request,
      deps({
        loadAddressableContext: async () => ({ lists: addressableLists, defaultList: null }),
        parseItems: async () => ({ targetListId: 'list_garden', items: ['compost'] }),
        createItems
      })
    );

    expect(createItems).toHaveBeenCalledWith({
      userId: 'user_b',
      listPublicId: 'list_garden',
      titles: ['compost']
    });
    expect(response.kind).toBe('reply');
    if (response.kind === 'reply') expect(response.text).toContain('Added 1 item to Garden');
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
