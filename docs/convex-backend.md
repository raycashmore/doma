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
  second insight for a month (`insights/generation.ts`).
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
  `google-auth-library` auth → fetch current week `singleEvents=true` → replace),
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
afternoon, and watchout sections when relevant. Scheduled delivery splits that
stored briefing into a morning notification with the summary and morning details
only, and an afternoon notification with afternoon details. AI-generated
briefings can use optional Open-Meteo weather context to make the headline or
block lines more practical, such as noting a cold start or wet pickup. Afternoon
delivery can refresh the same weather context and add relevant afternoon
readiness notes when the afternoon message already has briefing content. Weather
decorates a briefing that schedule requirements already justify; it does not
trigger a quiet-day notification by itself.

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

Scheduled delivery runs from Convex cron during the local
`07:35 <= time < 08:30` morning retry window and the
`14:30 <= time < 15:00` afternoon retry window. The runner forces schedule sync
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

The `email/` module stores forwarded email source material in `capturedEmails`,
turns useful messages into current `emailNotices`, and records
`emailNoticeDeliveryAttempts` per notice and recipient. Triage and delivery are
separate boundaries: triage creates a board-visible notice or no-notice outcome,
while `email/deliveryRunner:deliverTelegramWorthyEmailNoticesForBot` sends only
notices marked `telegramWorthy` through the Bot gateway's provider-neutral
notification endpoint. Convex runs due triage from cron every 12 hours and
notice delivery from cron four times per day at fixed UTC times selected for
Sydney daytime/evening delivery. The triage cron is interval-based, not pinned
to fixed local wall-clock times.

Forwarded email delivery uses `FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS`, not
the morning briefing recipient configuration. Re-running delivery skips
recipients with a sent or skipped attempt for the same notice, while failed or
stale pending attempts remain inspectable and retryable.

## Helper Functions (`helpers.ts`)

Each table has corresponding helper functions that accept a `Doc<'tableName'>` and return derived values. The `computeTotals()` function aggregates across all tables for the grand total.

## Query Pattern

```typescript
// Paginated access with date ordering
.withIndex('by_date').order('desc').take(limit)
```

## Mutation Pattern

Use `ctx.db.patch()` with only provided fields for partial updates.
