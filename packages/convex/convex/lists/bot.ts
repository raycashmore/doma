import { v } from 'convex/values';

import { action, mutation, query } from '../_generated/server';
import { createListItemsForUser, readDefaultListForUser, setDefaultListForUser } from './botModel';
import { requireUserId } from './items';
import { createOpenAiListItemsProvider, type ListItemsParseProvider, parseListItemsMessage } from './parse';

function assertAuthorizedServiceToken(serviceToken: string) {
  const expectedToken = process.env.BOT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) {
    throw new Error('Unauthorized');
  }
}

function listItemsProviderFromEnv(): ListItemsParseProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.LIST_ITEMS_AI_MODEL;
  if (!apiKey || !model) return null;
  return createOpenAiListItemsProvider({ apiKey, model });
}

/** In-app: set the signed-in user's default list. The bot reads this later. */
export const setDefaultList = mutation({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const currentUserId = await requireUserId(ctx);
    return setDefaultListForUser(ctx, { currentUserId, publicId });
  }
});

export const defaultListForBot = query({
  args: { serviceToken: v.string(), clerkUserId: v.string() },
  handler: async (ctx, { serviceToken, clerkUserId }) => {
    assertAuthorizedServiceToken(serviceToken);
    return readDefaultListForUser(ctx, { currentUserId: clerkUserId });
  }
});

export const createListItemsForBot = mutation({
  args: {
    serviceToken: v.string(),
    clerkUserId: v.string(),
    listPublicId: v.string(),
    titles: v.array(v.string())
  },
  handler: async (ctx, { serviceToken, clerkUserId, listPublicId, titles }) => {
    assertAuthorizedServiceToken(serviceToken);
    const { list, items } = await createListItemsForUser(ctx, {
      currentUserId: clerkUserId,
      listPublicId,
      titles
    });
    return { list, items: items.map((item) => ({ id: item._id, title: item.title })) };
  }
});

export const parseListItemsForBot = action({
  args: { serviceToken: v.string(), messageText: v.string() },
  handler: async (_ctx, { serviceToken, messageText }) => {
    assertAuthorizedServiceToken(serviceToken);
    return parseListItemsMessage({ messageText, provider: listItemsProviderFromEnv() });
  }
});
