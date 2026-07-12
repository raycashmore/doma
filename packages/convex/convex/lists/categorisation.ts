import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { internalAction, internalMutation, internalQuery, mutation, type MutationCtx } from '../_generated/server';
import {
  assertCanEditList,
  findItemPropertyValue,
  readListItems,
  readListProperties,
  requireVisibleList
} from './items';

export type CategorisationOption = { id: string; label: string };

export type CategorisationItem = {
  itemId: string;
  title: string;
  notes?: string;
  updatedAt: number;
};

export type CategorisationProviderInput = {
  instruction: string;
  options: readonly CategorisationOption[];
  items: Array<{ title: string; notes?: string }>;
};

export type ListCategorisationProvider = (input: CategorisationProviderInput) => Promise<unknown>;

export type CategorisationAssignment = {
  itemId: string;
  expectedUpdatedAt: number;
  optionId: string;
};

export type CategorisationInput = {
  instruction: string;
  options: readonly CategorisationOption[];
  items: readonly CategorisationItem[];
};

export type CategorisationResult =
  | { status: 'applied'; assignmentCount: number }
  | { status: 'skipped'; reason: 'invalid_response' }
  | { status: 'failed'; reason: 'provider_failure' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAssignments(value: unknown, itemCount: number, optionIds: ReadonlySet<string>) {
  if (!isRecord(value) || !Array.isArray(value.assignments) || value.assignments.length !== itemCount) return null;

  const byIndex = new Map<number, string | null>();
  for (const assignment of value.assignments) {
    if (!isRecord(assignment)) return null;
    const { itemIndex, optionId } = assignment;
    if (
      typeof itemIndex !== 'number' ||
      !Number.isInteger(itemIndex) ||
      itemIndex < 0 ||
      itemIndex >= itemCount ||
      byIndex.has(itemIndex)
    ) {
      return null;
    }
    if (optionId !== null && (typeof optionId !== 'string' || !optionIds.has(optionId))) return null;
    byIndex.set(itemIndex, optionId);
  }

  return Array.from({ length: itemCount }, (_, itemIndex) => byIndex.get(itemIndex) ?? null);
}

/**
 * Runs one provider call and converts its index-based, option-constrained output
 * into guarded persistence assignments. The provider never receives item ids or
 * list data beyond titles, notes, the owner's instruction, and allowed options.
 */
export async function categoriseListItems({
  input,
  provider,
  applyAssignments
}: {
  input: CategorisationInput;
  provider: ListCategorisationProvider;
  applyAssignments: (assignments: CategorisationAssignment[]) => Promise<void>;
}): Promise<CategorisationResult> {
  let output: unknown;
  try {
    output = await provider({
      instruction: input.instruction,
      options: input.options,
      items: input.items.map(({ title, notes }) => (notes ? { title, notes } : { title }))
    });
  } catch {
    return { status: 'failed', reason: 'provider_failure' };
  }

  const optionIds = new Set(input.options.map((option) => option.id));
  const optionIdsByItem = parseAssignments(output, input.items.length, optionIds);
  if (!optionIdsByItem) return { status: 'skipped', reason: 'invalid_response' };

  const assignments = input.items.flatMap((item, index) => {
    const optionId = optionIdsByItem[index];
    return optionId ? [{ itemId: item.itemId, expectedUpdatedAt: item.updatedAt, optionId }] : [];
  });

  if (assignments.length) await applyAssignments(assignments);
  return { status: 'applied', assignmentCount: assignments.length };
}

const categorisationOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['assignments'],
  properties: {
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['itemIndex', 'optionId'],
        properties: {
          itemIndex: { type: 'integer' },
          optionId: { type: ['string', 'null'] }
        }
      }
    }
  }
} as const;

const categorisationSystemPrompt = [
  'Categorise each list item using only one supplied option id, or null when uncertain.',
  'Return one assignment for every itemIndex. Do not invent options or infer categories outside the supplied list.'
].join(' ');
const LIST_CATEGORISATION_TIMEOUT_MS = 10_000;

function openAiMessageContent(body: unknown): string | null {
  if (!isRecord(body) || !Array.isArray(body.choices)) return null;
  const firstChoice = body.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;
  return typeof firstChoice.message.content === 'string' ? firstChoice.message.content : null;
}

export function createOpenAiListCategorisationProvider({
  apiKey,
  model,
  fetchImpl = fetch
}: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}): ListCategorisationProvider {
  return async (input) => {
    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      signal: AbortSignal.timeout(LIST_CATEGORISATION_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: categorisationSystemPrompt },
          { role: 'user', content: JSON.stringify(input) }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'list_categorisation',
            strict: true,
            schema: categorisationOutputJsonSchema
          }
        }
      })
    });
    if (!response.ok) throw new Error(`List categorisation AI request failed with status ${response.status}`);
    const content = openAiMessageContent((await response.json()) as unknown);
    if (!content) throw new Error('List categorisation AI response did not include JSON content');
    return JSON.parse(content) as unknown;
  };
}

type ListCategorisationSource = {
  propertyId: Id<'listProperties'>;
  instruction: string;
  options: CategorisationOption[];
  items: CategorisationItem[];
};

type CategorisationRefs = {
  categorisationSource: FunctionReference<
    'query',
    'internal',
    { listId: Id<'lists'>; itemIds: Id<'listItems'>[] },
    ListCategorisationSource | null
  >;
  applyAssignments: FunctionReference<
    'mutation',
    'internal',
    { propertyId: Id<'listProperties'>; assignments: CategorisationAssignment[] },
    { appliedCount: number }
  >;
  runCategorisation: FunctionReference<
    'action',
    'internal',
    { listId: Id<'lists'>; itemIds: Id<'listItems'>[] },
    CategorisationResult | { status: 'idle' } | { status: 'skipped'; reason: 'missing_configuration' }
  >;
};

const categorisationRefs: CategorisationRefs = (
  internal as unknown as { lists: { categorisation: CategorisationRefs } }
).lists.categorisation;

function categorisationProviderFromEnv(): ListCategorisationProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.LIST_CATEGORISATION_AI_MODEL;
  if (!apiKey || !model) return null;
  return createOpenAiListCategorisationProvider({ apiKey, model });
}

export async function scheduleListCategorisation(
  ctx: Pick<MutationCtx, 'scheduler'>,
  { listId, itemIds }: { listId: Id<'lists'>; itemIds: Id<'listItems'>[] }
) {
  if (!itemIds.length) return;
  await ctx.scheduler.runAfter(0, categorisationRefs.runCategorisation, { listId, itemIds });
}

export const categorisationSource = internalQuery({
  args: { listId: v.id('lists'), itemIds: v.array(v.id('listItems')) },
  handler: async (ctx, { listId, itemIds }): Promise<ListCategorisationSource | null> => {
    const properties = await readListProperties(ctx, listId);
    const property = properties.find(
      (candidate) => candidate.type === 'select' && candidate.categorisationInstruction && candidate.options?.length
    );
    if (!property || !property.categorisationInstruction || !property.options?.length) return null;

    const items = await Promise.all(itemIds.map((itemId) => ctx.db.get(itemId)));
    const eligible: CategorisationItem[] = [];
    for (const item of items) {
      if (!item || item.listId !== listId || item.completedAt !== undefined) continue;
      const existing = await findItemPropertyValue(ctx, item._id, property._id);
      if (existing) continue;
      eligible.push({ itemId: item._id, title: item.title, notes: item.notes, updatedAt: item.updatedAt });
    }

    return {
      propertyId: property._id,
      instruction: property.categorisationInstruction,
      options: property.options,
      items: eligible
    };
  }
});

export async function applyCategorisationAssignmentsHandler(
  ctx: Pick<MutationCtx, 'db'>,
  { propertyId, assignments }: { propertyId: Id<'listProperties'>; assignments: CategorisationAssignment[] }
) {
  const property = await ctx.db.get(propertyId);
  if (property?.type !== 'select' || !property.categorisationInstruction) return { appliedCount: 0 };
  const optionIds = new Set(property.options?.map((option) => option.id));
  if (!optionIds.size) return { appliedCount: 0 };

  let appliedCount = 0;
  for (const assignment of assignments) {
    if (!optionIds.has(assignment.optionId)) continue;
    const item = await ctx.db.get(assignment.itemId as Id<'listItems'>);
    if (
      !item ||
      item.listId !== property.listId ||
      item.completedAt !== undefined ||
      item.updatedAt !== assignment.expectedUpdatedAt
    ) {
      continue;
    }

    const existing = await findItemPropertyValue(ctx, item._id, property._id);
    if (existing) continue;

    const now = Date.now();
    await ctx.db.insert('listItemPropertyValues', {
      listId: property.listId,
      listItemId: item._id,
      listPropertyId: property._id,
      selectOptionId: assignment.optionId,
      createdAt: now,
      updatedAt: now
    });
    appliedCount += 1;
  }

  return { appliedCount };
}

export const applyAssignments = internalMutation({
  args: {
    propertyId: v.id('listProperties'),
    assignments: v.array(
      v.object({
        itemId: v.id('listItems'),
        expectedUpdatedAt: v.number(),
        optionId: v.string()
      })
    )
  },
  handler: applyCategorisationAssignmentsHandler
});

export const runCategorisation = internalAction({
  args: { listId: v.id('lists'), itemIds: v.array(v.id('listItems')) },
  handler: async (ctx, args) => {
    const source = await ctx.runQuery(categorisationRefs.categorisationSource, args);
    if (!source) return { status: 'skipped' as const, reason: 'missing_configuration' as const };
    if (!source.items.length) return { status: 'idle' as const };

    const provider = categorisationProviderFromEnv();
    if (!provider) return { status: 'skipped' as const, reason: 'missing_configuration' as const };
    return categoriseListItems({
      input: source,
      provider,
      applyAssignments: async (assignments) => {
        await ctx.runMutation(categorisationRefs.applyAssignments, { propertyId: source.propertyId, assignments });
      }
    });
  }
});

export async function requestListCategorisationHandler(
  ctx: Pick<MutationCtx, 'auth' | 'db' | 'scheduler'>,
  { listPublicId }: { listPublicId: string }
) {
  const visible = await requireVisibleList(ctx, listPublicId);
  if (!visible) throw new Error('List unavailable');
  assertCanEditList(visible.list, visible.currentUserId);

  const configuredProperty = (await readListProperties(ctx, visible.list._id)).find(
    (property) => property.type === 'select' && property.categorisationInstruction && property.options?.length
  );
  if (!configuredProperty) throw new Error('No AI categorisation property is configured');

  const activeItems = (await readListItems(ctx, visible.list._id)).filter((item) => item.completedAt === undefined);
  const itemIds: Id<'listItems'>[] = [];
  for (const item of activeItems) {
    const existing = await findItemPropertyValue(ctx, item._id, configuredProperty._id);
    if (!existing) itemIds.push(item._id);
  }

  await scheduleListCategorisation(ctx, { listId: visible.list._id, itemIds });
  return { scheduledCount: itemIds.length };
}

export const autoCategoriseUnassignedItems = mutation({
  args: { listPublicId: v.string() },
  handler: requestListCategorisationHandler
});
