# Schedule — Google Calendar ingestion setup

The `schedule` app reads a family's Google calendars **read-only** via a Google
Cloud **service account**. No per-user OAuth. This is a one-time setup; after it,
the app syncs the current week on demand — when it loads and via a manual
refresh button (an unforced refresh is skipped if the data is under a minute
old).

## 1. Create the service account

1. In the Google Cloud console, create (or pick) a project.
2. Enable the **Google Calendar API** for it.
3. Create a **service account**; create a **JSON key** and download it.

## 2. Share the calendars with the service account

For each calendar to ingest (per-person and the shared/household one):

1. Google Calendar → Settings → that calendar → **Share with specific people**.
2. Add the service account's email (`...@...iam.gserviceaccount.com`) with
   **"See all event details"** (read) access.
3. Copy the calendar's **Calendar ID** (Settings → Integrate calendar).

## 3. Set Convex environment variables

In the Convex dashboard (Project → Settings → Environment Variables):

| Variable             | Value                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| `GOOGLE_SA_KEY`      | the entire service-account JSON key, stringified                                       |
| `SCHEDULE_CALENDARS` | `[{"calendarId":"<id>","who":"<memberId> or shared","kind":"dailyRequirements"}, ...]` |
| `SCHEDULE_MEMBERS`   | `[{"id":"<memberId>","label":"<name>","initials":"<initials>","tokens":[...]}, ...]`   |
| `SCHEDULE_TZ`        | IANA timezone, e.g. `Australia/Sydney`                                                 |

- A per-person calendar's `who` is that member's id; the shared calendar's `who`
  is the literal `shared`.
- **Member ids must be the generic `memberA`, `memberB`, `memberC`, `memberD`.**
  The schedule UI maps those ids to its lane colours and ignores any id
  outside that set (the event falls back to the first member). Put the real
  names in `label` and/or `tokens` — never use a real name as an `id`, so no
  real name reaches committed frontend source.
- `label` and `initials` drive the real lane labels in the authenticated app.
  `label` falls back to the first token, and `initials` falls back to initials
  derived from that label. Omit both in test/dev fixture flows to keep generic
  labels.
- Shared-calendar events are unassigned by default. To show an owner label in
  Schedule and briefings, add exactly one explicit description tag such as
  `@doma-owner(memberA)` (or `@doma-owner(memberA,memberB)`). The tag is removed
  from the stored event description and never shown to the household. Only
  configured generic member ids are accepted; names in event titles and ordinary
  description text never determine ownership.
- `tokens` remain available for display-label fallbacks and must not be used to
  infer shared-event ownership.
- Add `"kind":"dailyRequirements"` to calendars that carry day-specific
  household requirements, such as clothing expectations, items to bring,
  preparation notes, or timing constraints. Morning briefings treat these
  calendars as the authoritative source for actions.
- Event descriptions are stored after basic sanitization: HTML tags are
  removed, common entities are decoded, whitespace is normalized, and blank
  lines are dropped. Morning briefings can use descriptions from any listed
  calendar as readiness context.

These values hold real names, calendar ids, and sometimes school details. Keep
them **only** in Convex env — never in git (see `docs/agents/privacy.md`). Use
generic member ids, calendar ids, and requirement text in committed examples.

## 4. Verify

Trigger a sync manually and confirm rows land:

```bash
cd packages/convex
pnpm exec dotenv -e ../../.env.local -- convex run schedule/sync:run
```

It returns `{ count: <n>, lastSyncedAt: <ms> }`. Check the `scheduleEvents`
table in the dashboard. In the app, the data refreshes on load and via the
manual refresh button; `schedule/sync:run` above is the equivalent server-side
trigger for ops/testing.
