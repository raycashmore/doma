import { v } from 'convex/values';

import { action, mutation, query } from '../_generated/server';
import {
  type AddressableListSummary,
  createListItemsForUser,
  type ListsBotMutationCtx,
  type ListsBotReadCtx,
  readMealPlanningListForUser,
  readAddressableListsForUser,
  readDefaultListForUser,
  setDefaultListForUser
} from './botModel';
import { scheduleListCategorisation } from './categorisation';
import { requireUserId } from './items';
import {
  type AddressableList,
  createOpenAiListItemsProvider,
  type ListItemsParseProvider,
  parseListItemsMessage
} from './parse';

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

export async function addressableListsForBotHandler(
  ctx: ListsBotReadCtx,
  { serviceToken, clerkUserId }: { serviceToken: string; clerkUserId: string }
): Promise<AddressableListSummary[]> {
  assertAuthorizedServiceToken(serviceToken);
  return readAddressableListsForUser(ctx, { currentUserId: clerkUserId });
}

export async function mealPlanningListForBotHandler(
  ctx: ListsBotReadCtx,
  { serviceToken, clerkUserId, publicId }: { serviceToken: string; clerkUserId: string; publicId: string }
) {
  assertAuthorizedServiceToken(serviceToken);
  return readMealPlanningListForUser(ctx, { currentUserId: clerkUserId, publicId });
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
  const listId = items[0]?.listId;
  if (listId) await scheduleListCategorisation(ctx, { listId, itemIds: items.map((item) => item._id) });
  return { list, items: items.map((item) => ({ id: item._id, title: item.title })) };
}

export async function parseListItemsForBotHandler({
  serviceToken,
  messageText,
  addressableLists = [],
  defaultListId = null
}: {
  serviceToken: string;
  messageText: string;
  addressableLists?: AddressableList[];
  defaultListId?: string | null;
}) {
  assertAuthorizedServiceToken(serviceToken);
  return parseListItemsMessage({
    messageText,
    provider: listItemsProviderFromEnv(),
    addressableLists,
    defaultListId
  });
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

export const addressableListsForBot = query({
  args: { serviceToken: v.string(), clerkUserId: v.string() },
  handler: (ctx, args) => addressableListsForBotHandler(ctx, args)
});

export const mealPlanningListForBot = query({
  args: { serviceToken: v.string(), clerkUserId: v.string(), publicId: v.string() },
  handler: (ctx, args) => mealPlanningListForBotHandler(ctx, args)
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
  args: {
    serviceToken: v.string(),
    messageText: v.string(),
    addressableLists: v.optional(v.array(v.object({ id: v.string(), name: v.string() }))),
    defaultListId: v.optional(v.union(v.string(), v.null()))
  },
  handler: (_ctx, args) => parseListItemsForBotHandler(args)
});
