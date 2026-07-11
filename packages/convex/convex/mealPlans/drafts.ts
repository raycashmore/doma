import { v } from 'convex/values';

import { mutation } from '../_generated/server';
import { createListItemsForUser } from '../lists/botModel';
import type { ListsMutationCtx } from '../lists/items';

export const MEAL_PLAN_DRAFT_TTL_MS = 30 * 60 * 1_000;

type MealPlanDraftRow = {
  _id: string;
  userId: string;
  providerChatId: string;
  shoppingListPublicId: string;
  ingredientTitles: string[];
  expiresAt: number;
  createdAt: number;
  supersededAt?: number;
  appliedAt?: number;
};

export type ApplyMealPlanDraftResult =
  | { kind: 'applied'; createdTitles: string[]; listName: string }
  | { kind: 'missing' }
  | { kind: 'expired' }
  | { kind: 'already_applied' };

async function draftsForUserAndChat(
  ctx: ListsMutationCtx,
  { currentUserId, providerChatId }: { currentUserId: string; providerChatId: string }
) {
  return (await ctx.db
    .query('mealPlanDrafts')
    .withIndex('by_user_and_chat', (q) => q.eq('userId', currentUserId).eq('providerChatId', providerChatId))
    .collect()) as MealPlanDraftRow[];
}

export async function saveMealPlanDraftForUser(
  ctx: ListsMutationCtx,
  {
    currentUserId,
    providerChatId,
    shoppingListPublicId,
    ingredientTitles
  }: {
    currentUserId: string;
    providerChatId: string;
    shoppingListPublicId: string;
    ingredientTitles: string[];
  }
) {
  const now = Date.now();
  const drafts = await draftsForUserAndChat(ctx, { currentUserId, providerChatId });
  await Promise.all(
    drafts
      .filter((draft) => draft.appliedAt === undefined && draft.supersededAt === undefined)
      .map((draft) => ctx.db.patch(draft._id as never, { supersededAt: now }))
  );

  return ctx.db.insert('mealPlanDrafts', {
    userId: currentUserId,
    providerChatId,
    shoppingListPublicId,
    ingredientTitles,
    expiresAt: now + MEAL_PLAN_DRAFT_TTL_MS,
    createdAt: now
  });
}

export async function applyLatestMealPlanDraftForUser(
  ctx: ListsMutationCtx,
  { currentUserId, providerChatId }: { currentUserId: string; providerChatId: string }
): Promise<ApplyMealPlanDraftResult> {
  const draft = (await draftsForUserAndChat(ctx, { currentUserId, providerChatId }))
    .filter((candidate) => candidate.supersededAt === undefined)
    .sort((left, right) => right.createdAt - left.createdAt)[0];
  if (!draft) return { kind: 'missing' };
  if (draft.appliedAt !== undefined) return { kind: 'already_applied' };
  if (draft.expiresAt <= Date.now()) return { kind: 'expired' };

  const created = await createListItemsForUser(ctx, {
    currentUserId,
    listPublicId: draft.shoppingListPublicId,
    titles: draft.ingredientTitles
  });
  await ctx.db.patch(draft._id as never, { appliedAt: Date.now() });
  return { kind: 'applied', createdTitles: created.items.map((item) => item.title), listName: created.list.name };
}

function assertAuthorizedServiceToken(serviceToken: string) {
  const expectedToken = process.env.BOT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) throw new Error('Unauthorized');
}

export const saveMealPlanDraftForBot = mutation({
  args: {
    serviceToken: v.string(),
    clerkUserId: v.string(),
    providerChatId: v.string(),
    shoppingListPublicId: v.string(),
    ingredientTitles: v.array(v.string())
  },
  handler: (ctx, { serviceToken, clerkUserId, providerChatId, shoppingListPublicId, ingredientTitles }) => {
    assertAuthorizedServiceToken(serviceToken);
    return saveMealPlanDraftForUser(ctx, {
      currentUserId: clerkUserId,
      providerChatId,
      shoppingListPublicId,
      ingredientTitles
    });
  }
});

export const applyLatestMealPlanDraftForBot = mutation({
  args: { serviceToken: v.string(), clerkUserId: v.string(), providerChatId: v.string() },
  handler: (ctx, { serviceToken, clerkUserId, providerChatId }) => {
    assertAuthorizedServiceToken(serviceToken);
    return applyLatestMealPlanDraftForUser(ctx, { currentUserId: clerkUserId, providerChatId });
  }
});
