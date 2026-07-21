import { v } from 'convex/values';

import { mutation, type MutationCtx } from '../_generated/server';

const MAX_TITLE_LENGTH = 80;
const MAX_DETAIL_LENGTH = 1_000;

type ManualNoteMutationCtx = Pick<MutationCtx, 'auth' | 'db'>;
type ManualNoteInput = {
  title: string;
  detail?: string;
  dueDate?: string;
};

function optionalTrimmed(value: string | undefined, maxLength: number, label: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) throw new Error(`${label} is too long`);
  return trimmed;
}

function validCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizeManualNoteInput(input: ManualNoteInput) {
  const title = input.title.trim();
  if (!title) throw new Error('Title is required');
  if (title.length > MAX_TITLE_LENGTH) throw new Error(`Title must be ${MAX_TITLE_LENGTH} characters or fewer`);

  const detail = optionalTrimmed(input.detail, MAX_DETAIL_LENGTH, 'Details');
  const dueDate = optionalTrimmed(input.dueDate, 10, 'Due date');
  if (dueDate && !validCalendarDate(dueDate)) throw new Error('Due date is invalid');

  return { title, detail, dueDate };
}

export async function createManualNoteHandler(ctx: ManualNoteMutationCtx, args: ManualNoteInput) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const now = Date.now();
  const row = {
    ...normalizeManualNoteInput(args),
    authorUserId: identity.subject,
    createdAt: now,
    updatedAt: now
  };
  const id = await ctx.db.insert('manualNotes', row);
  return { _id: id, ...row };
}

export async function updateManualNoteHandler(
  ctx: ManualNoteMutationCtx,
  args: ManualNoteInput & { noteId: Parameters<ManualNoteMutationCtx['db']['get']>[0] }
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const existing = await ctx.db.get(args.noteId);
  if (!existing) throw new Error('Note unavailable');

  const patch = { ...normalizeManualNoteInput(args), updatedAt: Date.now() };
  await ctx.db.patch(args.noteId, patch);
  return { ...existing, ...patch };
}

const manualNoteArgs = {
  title: v.string(),
  detail: v.optional(v.string()),
  dueDate: v.optional(v.string())
};

export const createManualNote = mutation({
  args: manualNoteArgs,
  handler: createManualNoteHandler
});

export const updateManualNote = mutation({
  args: { noteId: v.id('manualNotes'), ...manualNoteArgs },
  handler: updateManualNoteHandler
});
