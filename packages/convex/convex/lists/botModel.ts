import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import {
  assertCanEditList,
  findListByPublicId,
  isListVisibleToUser,
  type ListsMutationCtx,
  type ListsReadCtx,
  readListItemPropertyValuesByListId,
  readListItems,
  readListProperties,
  sortListProperties
} from './items';
import { nextActiveSortOrder } from './transitions';

type BotReadCtx = ListsReadCtx;
type BotWriteCtx = ListsMutationCtx;

export type ListsBotReadCtx = BotReadCtx;
export type ListsBotMutationCtx = BotWriteCtx & Pick<MutationCtx, 'scheduler'>;

export type DefaultListSummary = { publicId: string; name: string };

export type AddressableListSummary = { id: string; name: string };

export type MealPlanningList = {
  publicId: string;
  name: string;
  properties: Array<{
    id: string;
    name: string;
    type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
    options?: Array<{ id: string; label: string }>;
  }>;
  activeItems: Array<{
    id: string;
    title: string;
    propertyValues: Array<{
      propertyId: string;
      textValue?: string;
      numberValue?: number;
      selectOptionId?: string;
    }>;
  }>;
};

/**
 * The lists a household user can have the bot target: their own personal lists
 * plus every shared list. Returned by list publicId (stable across renames) so
 * the parser resolves to an id, not the message's wording.
 */
export async function readAddressableListsForUser(
  ctx: BotReadCtx,
  { currentUserId }: { currentUserId: string }
): Promise<AddressableListSummary[]> {
  // Read only what the user can address: their own lists via by_created_by and
  // every shared list via by_visibility. Cost scales with the addressable set,
  // not the whole table. Merge by list _id so a shared list the user created
  // (returned by both indexes) appears once.
  const [ownLists, sharedLists] = await Promise.all([
    ctx.db
      .query('lists')
      .withIndex('by_created_by', (q) => q.eq('createdByUserId', currentUserId))
      .collect(),
    ctx.db
      .query('lists')
      .withIndex('by_visibility', (q) => q.eq('visibility', 'shared'))
      .collect()
  ]);

  const byId = new Map<Id<'lists'>, Doc<'lists'>>();
  for (const list of [...ownLists, ...sharedLists]) byId.set(list._id, list);

  return [...byId.values()].map((list) => ({ id: list.publicId, name: list.name }));
}

async function findDefaultRow(ctx: BotReadCtx, currentUserId: string) {
  return ctx.db
    .query('listDefaults')
    .withIndex('by_user', (q) => q.eq('userId', currentUserId))
    .unique();
}

/**
 * Resolve the household user's default list to its current publicId and name.
 * The default is stored by list id, so this survives renames; it returns null
 * when no default is set or the target list is no longer visible to the user.
 */
export async function readDefaultListForUser(
  ctx: BotReadCtx,
  { currentUserId }: { currentUserId: string }
): Promise<DefaultListSummary | null> {
  const row = await findDefaultRow(ctx, currentUserId);
  if (!row) return null;

  const list = await ctx.db.get(row.listId);
  if (!list || !isListVisibleToUser(list, currentUserId)) return null;

  return { publicId: list.publicId, name: list.name };
}

/**
 * Read one addressable list with only the recipe/planning fields the bot needs.
 * The service caller still acts as the linked household user, so another
 * household user's personal list can never become planning context.
 */
export async function readMealPlanningListForUser(
  ctx: BotReadCtx,
  { currentUserId, publicId }: { currentUserId: string; publicId: string }
): Promise<MealPlanningList | null> {
  const list = await findListByPublicId(ctx, publicId);
  if (!list || !isListVisibleToUser(list, currentUserId)) return null;

  const [items, propertyRows, propertyValues] = await Promise.all([
    readListItems(ctx, list._id),
    readListProperties(ctx, list._id),
    readListItemPropertyValuesByListId(ctx, list._id)
  ]);
  const properties = sortListProperties(propertyRows);
  const propertyValuesByItem = new Map<string, typeof propertyValues>();
  for (const item of items) propertyValuesByItem.set(item._id, []);
  for (const value of propertyValues) propertyValuesByItem.get(value.listItemId)?.push(value);

  return {
    publicId: list.publicId,
    name: list.name,
    properties: properties.map((property) => ({
      id: property._id,
      name: property.name,
      type: property.type,
      options: property.options
    })),
    activeItems: items
      .filter((item) => item.completedAt === undefined)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt - right.createdAt)
      .map((item) => ({
        id: item._id,
        title: item.title,
        propertyValues: (propertyValuesByItem.get(item._id) ?? []).map((value) => ({
          propertyId: value.listPropertyId,
          textValue: value.textValue,
          numberValue: value.numberValue,
          selectOptionId: value.selectOptionId
        }))
      }))
  };
}

export async function setDefaultListForUser(
  ctx: BotWriteCtx,
  { currentUserId, publicId }: { currentUserId: string; publicId: string }
): Promise<DefaultListSummary> {
  const list = await findListByPublicId(ctx, publicId);
  if (!list || !isListVisibleToUser(list, currentUserId)) throw new Error('List unavailable');

  const now = Date.now();
  const existing = await findDefaultRow(ctx, currentUserId);
  if (existing) {
    await ctx.db.patch(existing._id, { listId: list._id, updatedAt: now });
  } else {
    await ctx.db.insert('listDefaults', {
      userId: currentUserId,
      listId: list._id,
      createdAt: now,
      updatedAt: now
    });
  }

  return { publicId: list.publicId, name: list.name };
}

export type CreatedBotListItem = { _id: Id<'listItems'>; listId: Id<'lists'>; title: string };

/**
 * Create title-only list items in a list the given user can edit, acting as
 * that linked user rather than relying on ctx.auth. Mirrors the in-app
 * insertion order (one past the highest active order).
 */
export async function createListItemsForUser(
  ctx: BotWriteCtx,
  { currentUserId, listPublicId, titles }: { currentUserId: string; listPublicId: string; titles: string[] }
): Promise<{ list: DefaultListSummary; items: CreatedBotListItem[] }> {
  const list = await findListByPublicId(ctx, listPublicId);
  if (!list || !isListVisibleToUser(list, currentUserId)) throw new Error('List unavailable');
  assertCanEditList(list, currentUserId);

  const cleaned = titles.map((title) => title.trim()).filter((title) => title.length > 0);
  const now = Date.now();
  const activeItems = (await readListItems(ctx, list._id))
    .filter((item: Doc<'listItems'>) => item.completedAt === undefined)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  const baseSortOrder = nextActiveSortOrder(activeItems);

  const items: CreatedBotListItem[] = [];
  for (const [index, title] of cleaned.entries()) {
    const _id = (await ctx.db.insert('listItems', {
      listId: list._id,
      title,
      sortOrder: baseSortOrder + index,
      createdAt: now,
      updatedAt: now
    })) as Id<'listItems'>;
    items.push({ _id, listId: list._id, title });
  }

  return { list: { publicId: list.publicId, name: list.name }, items };
}
