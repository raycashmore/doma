import { formatConfirmation } from './confirmation';

export type ListsCapabilityRequest = {
  userId: string;
  messageText: string;
  receivedAt: number;
};

export type ListsCapabilityResponse = { kind: 'reply'; text: string } | { kind: 'no_response' };

export type DefaultListSummary = { publicId: string; name: string };

export type AddressableList = { id: string; name: string };

export type AddressableContext = {
  lists: AddressableList[];
  defaultList: DefaultListSummary | null;
};

export type ParsedListItems = {
  // A list publicId resolved from the addressable set, or null when the message
  // named no resolvable list.
  targetListId: string | null;
  // Present (key, even with a null value) when the parser saw routing intent it
  // could not resolve, so the confirmation can explain the fallback to the
  // default list. The string is the requested name; null means no trustworthy
  // name exists and the confirmation uses a generic explanation.
  requestedListName?: string | null;
  items: string[];
};

export type HandleListsCapabilityDeps = {
  loadAddressableContext: (input: { userId: string }) => Promise<AddressableContext>;
  parseItems: (input: {
    messageText: string;
    addressableLists: AddressableList[];
    defaultListId: string | null;
  }) => Promise<ParsedListItems>;
  createItems: (input: {
    userId: string;
    listPublicId: string;
    titles: string[];
  }) => Promise<{ list: DefaultListSummary; items: Array<{ id: string; title: string }> }>;
};

const FALLBACK_MESSAGE = 'I could not add that to your list just now. Please try again in a moment.';

export async function handleListsCapabilityRequest(
  request: ListsCapabilityRequest,
  deps: HandleListsCapabilityDeps
): Promise<ListsCapabilityResponse> {
  try {
    const { lists, defaultList } = await deps.loadAddressableContext({ userId: request.userId });

    const parsed = await deps.parseItems({
      messageText: request.messageText,
      addressableLists: lists,
      defaultListId: defaultList?.publicId ?? null
    });
    if (parsed.items.length === 0) {
      return { kind: 'reply', text: formatConfirmation({ kind: 'empty_parse' }) };
    }

    const namedList = parsed.targetListId ? lists.find((list) => list.id === parsed.targetListId) : undefined;

    // Resolution: a resolved named list wins; otherwise fall back to the
    // default. With neither, we cannot create anything.
    const target = namedList ?? defaultList;
    if (!target) {
      return { kind: 'reply', text: formatConfirmation({ kind: 'no_default' }) };
    }
    const targetPublicId = namedList ? namedList.id : (target as DefaultListSummary).publicId;

    const created = await deps.createItems({
      userId: request.userId,
      listPublicId: targetPublicId,
      titles: parsed.items
    });

    // An unresolved-target state (the parser saw routing intent yet no list
    // resolved) means we landed on the default; say so. The requested name may
    // be null, in which case the confirmation explains the fallback generically.
    const usedFallback = !namedList && 'requestedListName' in parsed;
    if (usedFallback) {
      return {
        kind: 'reply',
        text: formatConfirmation({
          kind: 'created_with_fallback',
          requestedListName: parsed.requestedListName ?? null,
          listName: created.list.name,
          itemTitles: created.items.map((item) => item.title)
        })
      };
    }

    return {
      kind: 'reply',
      text: formatConfirmation({
        kind: 'created',
        listName: created.list.name,
        itemTitles: created.items.map((item) => item.title)
      })
    };
  } catch (error) {
    console.error('[lists.bot] Capability request failed', error);
    return { kind: 'reply', text: FALLBACK_MESSAGE };
  }
}
