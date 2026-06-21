import { formatConfirmation } from './confirmation';

export type ListsCapabilityRequest = {
  userId: string;
  messageText: string;
  receivedAt: number;
};

export type ListsCapabilityResponse = { kind: 'reply'; text: string } | { kind: 'no_response' };

export type DefaultListSummary = { publicId: string; name: string };

export type HandleListsCapabilityDeps = {
  parseItems: (input: { messageText: string }) => Promise<{ targetListId: null; items: string[] }>;
  loadDefaultList: (input: { userId: string }) => Promise<DefaultListSummary | null>;
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
    const { items } = await deps.parseItems({ messageText: request.messageText });
    if (items.length === 0) {
      return { kind: 'reply', text: formatConfirmation({ kind: 'empty_parse' }) };
    }

    const defaultList = await deps.loadDefaultList({ userId: request.userId });
    if (!defaultList) {
      return { kind: 'reply', text: formatConfirmation({ kind: 'no_default' }) };
    }

    const created = await deps.createItems({
      userId: request.userId,
      listPublicId: defaultList.publicId,
      titles: items
    });

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
