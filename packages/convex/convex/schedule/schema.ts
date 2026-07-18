import { defineTable } from 'convex/server';
import { v } from 'convex/values';

// One row per expanded Google Calendar event instance for the current and next week.
// The table is fully replaced on every sync.
export const scheduleEventsTable = defineTable({
  googleEventId: v.string(),
  calendarId: v.string(),
  start: v.number(), // epoch ms
  end: v.number(), // epoch ms
  allDay: v.boolean(),
  title: v.string(),
  kind: v.optional(v.literal('dailyRequirements')),
  description: v.optional(v.string()),
  location: v.optional(v.string()),
  who: v.array(v.string()), // schedule member keys (from SCHEDULE_MEMBERS config)
  recurring: v.boolean(),
  htmlLink: v.string() // Google Calendar event URL ("Open in Google Calendar")
}).index('by_start', ['start']);

// Single-row sync metadata (keyed 'default'): when the last successful sync
// completed. Powers the "Synced X ago" banner and the skip-if-fresh check.
export const scheduleSyncMetaTable = defineTable({
  key: v.literal('default'),
  lastSyncedAt: v.number() // epoch ms
}).index('by_key', ['key']);

export const scheduleReminderAttemptsTable = defineTable({
  reminderKey: v.string(),
  recipientUserId: v.optional(v.string()),
  googleEventId: v.string(),
  eventStart: v.number(),
  leadTimeMinutes: v.number(),
  attemptedAt: v.number(),
  status: v.union(v.literal('pending'), v.literal('sent'), v.literal('skipped'), v.literal('failed')),
  providerErrorCode: v.optional(v.string())
})
  .index('by_reminder_key', ['reminderKey'])
  .index('by_reminder_recipient', ['reminderKey', 'recipientUserId'])
  .index('by_attempted_at', ['attemptedAt']);
