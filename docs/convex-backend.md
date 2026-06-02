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

- **11 tables** defined in `schema.ts`: 9 financial tables plus `scheduleEvents` and `scheduleSyncMeta` (read-only Google Calendar data — see [Schedule ingestion](#schedule-ingestion))
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

## Helper Functions (`helpers.ts`)

Each table has corresponding helper functions that accept a `Doc<'tableName'>` and return derived values. The `computeTotals()` function aggregates across all tables for the grand total.

## Query Pattern

```typescript
// Paginated access with date ordering
.withIndex('by_date').order('desc').take(limit)
```

## Mutation Pattern

Use `ctx.db.patch()` with only provided fields for partial updates.
