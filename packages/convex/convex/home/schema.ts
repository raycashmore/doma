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
