import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const manualNotesTable = defineTable({
  title: v.string(),
  detail: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  authorUserId: v.string(),
  createdAt: v.number(),
  updatedAt: v.number()
}).index('by_updated_at', ['updatedAt']);

export const boardSourceKind = v.union(
  v.literal('today'),
  v.literal('meals'),
  v.literal('forwardedEmail'),
  v.literal('monthlySpendingInsight'),
  v.literal('manualNote')
);

export const boardArchivesTable = defineTable({
  occurrenceId: v.string(),
  sourceKind: boardSourceKind,
  archivedByUserId: v.string(),
  archivedAt: v.number()
}).index('by_occurrence_id', ['occurrenceId']);
