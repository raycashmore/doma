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

- **9 tables** defined in `schema.ts`, all financial data
- **Date field:** All tables indexed by `date` (Unix timestamp in milliseconds) with a `by_date` index
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

## Helper Functions (`helpers.ts`)

Each table has corresponding helper functions that accept a `Doc<'tableName'>` and return derived values. The `computeTotals()` function aggregates across all tables for the grand total.

## Query Pattern

```typescript
// Paginated access with date ordering
.withIndex('by_date').order('desc').take(limit)
```

## Mutation Pattern

Use `ctx.db.patch()` with only provided fields for partial updates.
