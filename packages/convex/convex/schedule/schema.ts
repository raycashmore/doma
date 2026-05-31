import { defineTable } from 'convex/server';
import { v } from 'convex/values';

// One row per expanded Google Calendar event instance for the current week.
// The table is fully replaced on every sync, so it only ever holds this week.
export const scheduleEventsTable = defineTable({
  googleEventId: v.string(),
  calendarId: v.string(),
  start: v.number(), // epoch ms
  end: v.number(), // epoch ms
  allDay: v.boolean(),
  title: v.string(),
  location: v.optional(v.string()),
  who: v.array(v.string()), // member ids
  recurring: v.boolean(),
  htmlLink: v.string()
}).index('by_start', ['start']);
