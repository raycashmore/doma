import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

import type { BotConfig } from '../config.js';
import type { CapabilityHandler } from '../dispatch/types.js';
import { buildMealPlannerInput, buildWeeklyMealPlan } from './mealPlanning.js';

export type MealPlanningList = {
  publicId: string;
  name: string;
  properties: Array<{ id: string; name: string; type: string; options?: Array<{ id: string; label: string }> }>;
  activeItems: Array<{
    id: string;
    title: string;
    propertyValues: Array<{ propertyId: string; textValue?: string; numberValue?: number; selectOptionId?: string }>;
  }>;
};

type ListSummary = { id: string; name: string };

function parseAsk(messageText: string) {
  const match = /^\/meals(?:@\w+)?\s+(.+?)\s*\|\s*(.+?)(?:\s*\|\s*(.+))?$/i.exec(messageText.trim());
  if (!match) return null;
  const constraint = parseConstraint(match[3]);
  if (!constraint) return null;
  return { recipeListName: match[1]!.trim(), shoppingListName: match[2]!.trim(), constraint };
}

function parseConstraint(value: string | undefined) {
  if (!value?.trim()) return { avoidIngredient: null, preferQuick: false };
  let avoidIngredient: string | null = null;
  let preferQuick = false;
  for (const part of value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)) {
    if (part.toLowerCase() === 'quick') {
      preferQuick = true;
      continue;
    }
    const avoid = /^avoid:\s*(.+)$/i.exec(part);
    if (avoid?.[1]?.trim()) {
      avoidIngredient = avoid[1].trim();
      continue;
    }
    return null;
  }
  return { avoidIngredient, preferQuick };
}

function findNamedList(lists: ListSummary[], name: string): ListSummary | 'ambiguous' | null {
  const normalized = name.trim().toLowerCase();
  const matches = lists.filter((list) => list.name.trim().toLowerCase() === normalized);
  if (matches.length > 1) return 'ambiguous';
  return matches[0] ?? null;
}

function valueForProperty(item: MealPlanningList['activeItems'][number], propertyId: string) {
  return item.propertyValues.find((value) => value.propertyId === propertyId);
}

function selectLabelForProperty(
  item: MealPlanningList['activeItems'][number],
  property: MealPlanningList['properties'][number]
) {
  const optionId = valueForProperty(item, property.id)?.selectOptionId;
  return property.options?.find((option) => option.id === optionId)?.label ?? null;
}

function propertyByName(list: MealPlanningList, name: string) {
  return list.properties.find((property) => property.name.trim().toLowerCase() === name) ?? null;
}

function recipesFromList(list: MealPlanningList) {
  const ingredients = propertyByName(list, 'ingredients');
  if (!ingredients) return [];
  const serves = propertyByName(list, 'serves');
  const prepMinutes = propertyByName(list, 'prep minutes');
  const mealType = propertyByName(list, 'meal type');

  return list.activeItems.map((item) => ({
    title: item.title,
    ingredients: valueForProperty(item, ingredients.id)?.textValue ?? '',
    serves: serves ? (valueForProperty(item, serves.id)?.numberValue ?? null) : null,
    prepMinutes: prepMinutes ? (valueForProperty(item, prepMinutes.id)?.numberValue ?? null) : null,
    mealType: mealType ? selectLabelForProperty(item, mealType) : null
  }));
}

function formatPlan(
  plan: NonNullable<ReturnType<typeof buildWeeklyMealPlan>>,
  recipeListName: string,
  shoppingListName: string
) {
  return [
    `Weekly meal plan from ${recipeListName}:`,
    ...plan.days.map(
      (day) =>
        `- ${day.weekday}: Dinner — ${day.dinnerRecipeTitle}; Lunch — ${
          day.lunch.kind === 'leftovers' ? `leftovers from ${day.lunch.recipeTitle}` : day.lunch.recipeTitle
        }`
    ),
    '',
    `Ingredients to add to ${shoppingListName}:`,
    ...(plan.ingredientDraft.length > 0 ? plan.ingredientDraft.map((ingredient) => `- ${ingredient}`) : ['- None'])
  ].join('\n');
}

function busyWeekdaysFromEvents(events: Array<{ start: number }>) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const weekday = new Intl.DateTimeFormat('en-AU', { weekday: 'long', timeZone: 'Australia/Sydney' }).format(
      new Date(event.start)
    );
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count >= 2).map(([weekday]) => weekday);
}

export function createMealPlanningCapability({
  loadAddressableLists,
  loadList,
  loadBusyWeekdays = async () => []
}: {
  loadAddressableLists: (userId: string) => Promise<ListSummary[]>;
  loadList: (userId: string, publicId: string) => Promise<MealPlanningList | null>;
  loadBusyWeekdays?: () => Promise<string[]>;
}): CapabilityHandler {
  return async (request) => {
    const ask = parseAsk(request.messageText);
    if (!ask) {
      return {
        kind: 'reply',
        text: 'Try /meals Recipes | Shopping, with an optional third part for a one-off constraint.'
      };
    }
    const lists = await loadAddressableLists(request.userId);
    const recipeList = findNamedList(lists, ask.recipeListName);
    const shoppingList = findNamedList(lists, ask.shoppingListName);
    if (recipeList === 'ambiguous') {
      return {
        kind: 'reply',
        text: `I found more than one list named ${ask.recipeListName}. Please rename one or use a unique list name.`
      };
    }
    if (shoppingList === 'ambiguous') {
      return {
        kind: 'reply',
        text: `I found more than one list named ${ask.shoppingListName}. Please rename one or use a unique list name.`
      };
    }
    if (!recipeList || !shoppingList) {
      return { kind: 'reply', text: 'I could not find both the recipe and Shopping lists by those names.' };
    }
    const [recipes, shopping] = await Promise.all([
      loadList(request.userId, recipeList.id),
      loadList(request.userId, shoppingList.id)
    ]);
    if (!recipes || !shopping) return { kind: 'reply', text: 'I could not load those lists just now.' };

    const [busyWeekdays] = await Promise.all([loadBusyWeekdays()]);
    const input = buildMealPlannerInput({
      recipes: recipesFromList(recipes),
      activeShoppingItemTitles: shopping.activeItems.map((item) => item.title),
      busyWeekdays,
      avoidIngredient: ask.constraint.avoidIngredient,
      preferQuick: ask.constraint.preferQuick
    });
    const plan = buildWeeklyMealPlan(input);
    if (!plan)
      return {
        kind: 'reply',
        text: 'I need at least one active recipe with an Ingredients text property before I can plan the week.'
      };

    return { kind: 'reply', text: formatPlan(plan, recipes.name, shopping.name) };
  };
}

const addressableListsForBot = makeFunctionReference<
  'query',
  { serviceToken: string; clerkUserId: string },
  ListSummary[]
>('lists.bot.addressableListsForBot');
const mealPlanningListForBot = makeFunctionReference<
  'query',
  { serviceToken: string; clerkUserId: string; publicId: string },
  MealPlanningList | null
>('lists.bot.mealPlanningListForBot');
const currentWeekForBot = makeFunctionReference<
  'query',
  { serviceToken: string },
  { events: Array<{ start: number }> }
>('schedule.queries.currentWeekForBot');

export function createConvexMealPlanningCapability(config: BotConfig): CapabilityHandler {
  if (!config.convexUrl) throw new Error('CONVEX_URL is required for the meals capability');
  const client = new ConvexHttpClient(config.convexUrl);
  return createMealPlanningCapability({
    loadAddressableLists: (userId) =>
      client.query(addressableListsForBot, { serviceToken: config.botServiceToken, clerkUserId: userId }),
    loadList: (userId, publicId) =>
      client.query(mealPlanningListForBot, { serviceToken: config.botServiceToken, clerkUserId: userId, publicId }),
    loadBusyWeekdays: async () =>
      busyWeekdaysFromEvents((await client.query(currentWeekForBot, { serviceToken: config.botServiceToken })).events)
  });
}
