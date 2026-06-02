# Commands

Run commands from the repository root unless a command includes `--filter`.

## Root Commands

```bash
pnpm dev           # Start all apps with Turbo
pnpm build         # Build all apps
pnpm lint          # Lint all apps
pnpm check-types   # TypeScript type checking
pnpm test          # Run tests across packages that define them
pnpm format        # Format with Prettier
pnpm format:check  # Check formatting without writing (used in CI)
pnpm bot           # Start the bot gateway on :3002
pnpm bot:test      # Run bot gateway tests
pnpm convex        # Start Convex dev for @repo/convex
pnpm seed          # Seed Convex data
pnpm seed:clear    # Clear seeded Convex data
pnpm seed:url -- <convex-url>       # Seed a specific Convex deployment
pnpm seed:url:clear -- <convex-url> # Clear seeded data from a specific Convex deployment
```

## Convex Seeding

Seed scripts run from the local machine and read a local excel spreadsheet. That
workbook is ignored by git and must exist locally before seeding.

Use `pnpm seed` for the local Convex deployment configured by `.env.local`.
The seed script clears seedable tables before inserting workbook data.

Use `pnpm seed:url` for an ephemeral Convex Preview deployment. Pass the Convex
cloud URL as the first argument:

```bash
pnpm seed:url -- https://dynamic-kingfisher-926.convex.cloud
```

To clear a target deployment without re-seeding it:

```bash
pnpm seed:url:clear -- https://dynamic-kingfisher-926.convex.cloud
```

Before running any seed command against a shared or remote deployment, confirm
the target URL with the user. Seeding replaces the existing seedable finance
tables on that deployment.

## App Commands

```bash
pnpm --filter home dev          # Home app on :3000
pnpm --filter home dev:no-auth  # Home app on :3000 without Clerk auth
pnpm --filter budget dev        # Budget app on :3001
pnpm --filter budget dev:no-auth # Budget app on :3001 without Clerk auth
pnpm --filter budget test       # Budget app Vitest suite
pnpm --filter api-bot dev       # Bot gateway on :3002
pnpm --filter api-bot test      # Bot gateway Vitest suite
pnpm --filter api-bot check-types # Bot gateway TypeScript check
pnpm --filter home build        # Verify Home route/UI/build changes
```
