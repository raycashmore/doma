# Convex Backend

Backend code lives in `packages/convex/convex/`.

## Seeding

Seed scripts run locally and read a local excel spreadsheet, which is
ignored by git. The seed command clears seedable finance tables on the target
deployment before inserting workbook data.

For a local Convex deployment:

```bash
pnpm seed
```

For a specific Convex Preview deployment:

```bash
pnpm seed:url -- https://<preview>.convex.cloud
```

To clear a target deployment without re-seeding it:

```bash
pnpm seed:url:clear -- https://<preview>.convex.cloud
```

Confirm the target URL before seeding any shared or remote deployment.

## Core Pattern: Derive at Read Time

Store only raw inputs in the database. All computed values are calculated at read time via helper functions in `helpers.ts`. Never store derived values.

**Example:** `cashAccounts` stores `saver` and `highInterest`. The total is computed by `cashAccountTotal()` in `helpers.ts`, not stored in the table.

**Exception:** Exchange rates (`gbpAud`, `usdAud`) ARE stored — they're external inputs, not derived values.

## Schema Conventions

- Financial tables store source finance data; schedule tables cache read-only
  Google Calendar data; briefing tables store generated morning briefings and
  per-recipient delivery attempts; email tables store forwarded email captures,
  triage notices, and per-recipient notice delivery attempts; the
  `spendingInsights` table stores AI-written monthly spending insights keyed by
  calendar month (`by_month_key`). The `insights/` module generates them via a
  12-hour cron sweep: input assembly from budget and spend category rows
  (`insights/assembly.ts`), an OpenAI-compatible provider with defensive
  parsing (`insights/ai.ts`), and an idempotent runner that never stores a
  second insight for a month (`insights/generation.ts`). Telegram delivery of
  the latest stored insight mirrors email notice delivery: a pure delivery
  cycle (`insights/delivery.ts`), per-month-and-recipient attempts in
  `spendingInsightDeliveryAttempts` with lease-based claiming
  (`insights/deliveryStore.ts`), and an hourly cron runner that skips cleanly
  when bot gateway config is absent (`insights/deliveryRunner.ts`).
- **Date field:** All financial tables indexed by `date` (Unix timestamp in milliseconds) with a `by_date` index
- **Crypto tables:** Use `by_platform` indexing in addition to date
- **Derived field comments:** Schema marks derived fields with `// DERIVED: ...` comments

### Mortgage/Budget Split

Budget rows store monthly income and non-mortgage outflows only. Mortgage-owned monthly values live on `mortgage`: `fixedPayment`, `variablePayment`, `rateVar`, `rateFixed`, `offset1`, and `offset2`.

Static property assumptions live in the single-row `mortgageConfig` table keyed by `"default"`. These values are still used by derived calculations such as equity and totals, but they no longer repeat on every monthly mortgage row.

Removed stored fields:

- `interestCharged` is no longer stored; existing UI now shows `fixedPayment`, `variablePayment`, and total payment instead.
- `principalPaid` is no longer stored because it is derived.
- `capitalGrowth` is no longer stored because it is derived.

All monetary values remain integer cents. Rate fields remain floats.

## Home noticeboard

The `home/` module exposes an authenticated active-board read model. It derives cards at query time from schedule briefing data, weekly meal plans, active forwarded-email notices, monthly spending insights, and shared manual notes. Expired or superseded notices and payload-free archived occurrences are removed before the result reaches the client.

`manualNotes` stores household-authored title, optional detail/due date, author user id, and timestamps; its Convex document id identifies the note. `boardArchives` stores no source payload: only the occurrence id, source kind, archiving user id, and archive timestamp. Archive mutations validate that the requested occurrence is currently visible and are idempotent, so a new source occurrence can appear later without restoring the archived one.

## Meals cookbook

The `meals/` module owns the shared household cookbook. Its `recipes` table and
authenticated queries and mutations serve every signed-in household user; it is
not a Lists model and does not own shopping-list items.

Recipes store a name, short description, preparation time, serving label,
suitability tags, ordered free-form ingredient lines, and instructions. The
module preserves ingredient-line order but does not parse quantities, scale
servings, normalise ingredients, or model pantry state.

The `weeklyMealPlans` table stores one authenticated household plan per Monday
week start. Each assignment references a recipe public id by weekday and meal
type (`schoolLunch` or `dinner`). Queries return the saved assignments; mutations
replace or clear one slot without copying ingredient data into the plan. The
frontend derives its shopping review at read time from the assigned recipes.
After explicit review, Meals sends the displayed rows to a Lists-owned,
authenticated mutation. That mutation atomically resolves exactly one shared
list named `Shopping` and creates the items, so Lists remains the authority for
both destination matching and the resulting list items.

Weekly meal proposals are recorded in `weeklyMealAgentRuns` as privacy-safe,
structured traces with a 30-day expiry. Agent tools use a dedicated service
token to read open slots, saved recipes, and normalized weekday busyness. The
authenticated apply mutation checks run ownership, expiry, plan version, empty
slots, and recipe suitability in one transaction before updating the plan; a
stale proposal writes nothing. A daily Convex cron removes expired traces.

## Schedule ingestion

The `schedule/` module (`packages/convex/convex/schedule/`) ingests a family's
Google calendars, read-only — a different shape from the financial tables (no
derive-at-read; the tables are a cache of an external source). Sync is
**on demand** (triggered by the app on load + a manual refresh button), not a
cron:

- `schema.ts` — the `scheduleEvents` table (one row per expanded event
  instance, indexed `by_start`) and the single-row `scheduleSyncMeta`
  (`lastSyncedAt`), composed into the root `defineSchema`.
- `week.ts`, `mapping.ts`, `syncPolicy.ts`, `credentials.ts` — pure,
  unit-tested helpers (tz-aware week range + all-day anchoring to local midnight
  in the configured tz; member derivation + row transform; skip-if-fresh
  decision; private-key newline normalization).
- `sync.ts` — a `"use node"` module with `performSync` (service-account
  `google-auth-library` auth → fetch current and following week
  `singleEvents=true` → replace),
  exposed two ways: `run` (internal, for the CLI/ops) and `refresh` (public,
  **Clerk-gated** — the app's entry point; unforced calls skip when data is
  fresh, the button passes `force`).
- `queries.ts` — `replaceAll` (internal mutation; full-table replace + stamp
  `lastSyncedAt`), `syncMeta` (internal; last-synced read for the freshness
  check), and `currentWeek` (Clerk-gated read returning `{ events, lastSyncedAt }`).

Config + secrets are Convex env vars (`GOOGLE_SA_KEY`, `SCHEDULE_CALENDARS`,
`SCHEDULE_MEMBERS`, `SCHEDULE_TZ`); never in git. Setup:
[`docs/schedule-ingestion-setup.md`](schedule-ingestion-setup.md).

## Morning briefing

The `briefing/` module stores one generated morning briefing per
`briefingKind + localDate`, initially `morning:<YYYY-MM-DD>`. The briefing uses
daily requirements events as the action source and ordinary schedule events as
timing context. It records delivery attempts per recipient so scheduled
delivery and `/briefing` replay stay idempotent.

Morning briefing messages render as compact readiness summaries, not raw event
feeds. Busy days lead with the shape of the day, then include morning,
afternoon, and watchout sections when relevant. The morning notification and
`/briefing` replay contain the headline and the full day's relevant details. A
morning notification is skipped when the day has no briefing content, including
on weekends. The weekday-only afternoon slot sends only unusual watchouts backed
entirely by ordinary schedule sources, and skips delivery when none qualify;
daily-requirements items never trigger it. AI-generated briefings can use optional
Open-Meteo weather context to make calendar-derived block lines more practical,
such as noting a cold start or wet pickup. Weather decorates a briefing that
schedule requirements already justify; it does not trigger a quiet-day
notification by itself.

Stored briefing text is plain text. The AI parser rejects responses that leak
internal member ids, use unknown member ownership, include markup delimiters, or
include escaped HTML entities. Invalid AI output falls back to the deterministic
schedule summary for that local date. Stored rows that no longer satisfy the
plain-text and known-member ownership contract are ignored for replay and
replaced on the next generation attempt. Channel-specific formatting belongs at
delivery time; Telegram delivery and delivery previews escape the plain text and
then apply their small keyword bolding rule.

Docs and tests must use generic member, calendar, and event labels. Generated
briefing text can contain private household schedule details, so do not copy it
into committed fixtures.

Scheduled delivery is scheduled by a 24-hour Convex reconciler during the local
`08:20 <= time < 08:50` morning retry window every day and the
`14:30 <= time < 15:00` afternoon retry window on weekdays only. The runner forces schedule sync
before generation when possible, reuses an existing stored briefing for morning
retries, refreshes the stored briefing after a successful afternoon sync, sends
through the bot gateway's provider-neutral `/notifications/send` endpoint, and
marks suppressed or empty delivery messages as skipped instead of sending an
empty notification. Morning and afternoon attempts use separate delivery keys so
one successful slot does not suppress the other. It adds a stale-data note when
the latest sync failed and cached schedule data is older than 12 hours.

Setup and operations live in [Deployment](deployment.md). Daily requirements
calendar setup lives in
[Schedule ingestion setup](schedule-ingestion-setup.md).

## Forwarded email notices

The `email/` module stores forwarded email source material in `capturedEmails`
and remains authoritative for current `emailNotices`. Convex claims pending
captures, then the Vercel Agent API performs typed AI SDK inference and records
a privacy-safe 30-day trace. A notice may include an extracted obligation, but
only high-priority obligations with a high-confidence future date create an
`emailReminderCandidates` row. Inference never sends a notification.

When configured, the Agent API also exports a best-effort Langfuse trace for
each triage generation. It records only input and output shape by default;
forwarded-email content is never exported.

Reminder delivery is deterministic. A 15-minute Convex sweep sends eligible
candidates at 7pm Australia/Sydney on the day before `dueOn`, through the Bot
gateway with topic `email.reminder`. It records attempts per candidate and
recipient, retries failed or stale claims only before the due date begins, and
suppresses delivery when the canonical notice is archived or superseded. A
payload-free `boardArchives` row for `emailNotice:<noticeId>` also cancels the
pending reminder, so Home remains the user-facing control surface.

Forwarded email delivery uses `FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS`, not
the morning briefing recipient configuration. Re-running delivery skips
recipients with a sent or skipped attempt for the same reminder candidate.

## Helper Functions (`helpers.ts`)

Each table has corresponding helper functions that accept a `Doc<'tableName'>` and return derived values. The `computeTotals()` function aggregates across all tables for the grand total.

## Query Pattern

```typescript
// Paginated access with date ordering
.withIndex('by_date').order('desc').take(limit)
```

## Mutation Pattern

Use `ctx.db.patch()` with only provided fields for partial updates.
