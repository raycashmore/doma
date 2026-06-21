import { v } from 'convex/values';

import { action, mutation, query } from '../_generated/server';
import {
  createListItemsForUser,
  type ListsBotMutationCtx,
  type ListsBotReadCtx,
  readDefaultListForUser,
  setDefaultListForUser
} from './botModel';
import { requireUserId } from './items';
import { createOpenAiListItemsProvider, type ListItemsParseProvider, parseListItemsMessage } from './parse';

export function assertAuthorizedServiceToken(serviceToken: string) {
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

// Exported handlers carry the service-token guard so it can be tested directly,
// independent of the Convex function wrappers below.
export async function defaultListForBotHandler(
  ctx: ListsBotReadCtx,
  { serviceToken, clerkUserId }: { serviceToken: string; clerkUserId: string }
) {
  assertAuthorizedServiceToken(serviceToken);
  return readDefaultListForUser(ctx, { currentUserId: clerkUserId });
}

export async function createListItemsForBotHandler(
  ctx: ListsBotMutationCtx,
  {
    serviceToken,
    clerkUserId,
    listPublicId,
    titles
  }: { serviceToken: string; clerkUserId: string; listPublicId: string; titles: string[] }
) {
  assertAuthorizedServiceToken(serviceToken);
  const { list, items } = await createListItemsForUser(ctx, { currentUserId: clerkUserId, listPublicId, titles });
  return { list, items: items.map((item) => ({ id: item._id, title: item.title })) };
}

export async function parseListItemsForBotHandler({
  serviceToken,
  messageText
}: {
  serviceToken: string;
  messageText: string;
}) {
  assertAuthorizedServiceToken(serviceToken);
  return parseListItemsMessage({ messageText, provider: listItemsProviderFromEnv() });
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
  handler: (ctx, args) => defaultListForBotHandler(ctx, args)
});

export const createListItemsForBot = mutation({
  args: {
    serviceToken: v.string(),
    clerkUserId: v.string(),
    listPublicId: v.string(),
    titles: v.array(v.string())
  },
  handler: (ctx, args) => createListItemsForBotHandler(ctx, args)
});

export const parseListItemsForBot = action({
  args: { serviceToken: v.string(), messageText: v.string() },
  handler: (_ctx, args) => parseListItemsForBotHandler(args)
});
