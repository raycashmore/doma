# Doma

Doma: household management system.

A Turborepo monorepo with Vercel Multi-Zones, Convex, Clerk, and a shared bot
gateway for Telegram notifications.

## What lives here

- `apps/home` is the apex zone and account home. It owns the shared domain,
  cross-zone rewrites, and Telegram notification settings.
- `apps/budget` is the budgeting app mounted at `/budget`.
- `apps/schedule` is the family scheduler mounted at `/schedule` (the first
  Next.js zone; the others are TanStack Start).
- `apps/lists` is the SvelteKit Lists app mounted at `/lists`.
- `apps/api-bot` is the bot gateway for Telegram linking, outbound
  notifications, and inbound command handling.

## Apps

- `apps/home` — apex zone, summary/settings shell (port 3000)
- `apps/budget` — Budget app at `/budget` (port 3001)
- `apps/schedule` — Schedule app at `/schedule`, Next.js App Router (port 3003)
- `apps/lists` — Lists app at `/lists`, SvelteKit (port 3004)
- `apps/api-bot` — Hono bot gateway for Telegram/webhook flows (port 3002)
- `apps/api-*` — convention for other non-Convex backend experiments

## Packages

- `@repo/convex` — shared Convex schema/functions
- `@repo/app-registry` — framework-neutral app metadata and navigation helpers
- `@repo/tokens` — design tokens (Tailwind v4)
- `@repo/shell` — shared React Sidebar + AppFrame + MobileNav + auth context
  (`UrlAuthProvider`/`SignInLayout`). TanStack Start and Next.js apps consume it;
  Svelte apps use their own shell layout and the shared app registry. Each app
  supplies its own Clerk `AuthGate` adapter.
- `@repo/ui` — shared React primitives

## Commands

```bash
pnpm dev           # Start all apps (turbo)
pnpm build         # Build all apps
pnpm lint          # Lint everywhere
pnpm check-types   # TypeScript across the workspace
pnpm format        # Prettier
pnpm test          # Workspace tests
pnpm convex        # Convex dev (regenerates packages/convex/convex/_generated)
pnpm bot           # Bot gateway dev server on :3002
pnpm bot:test      # Bot gateway test suite
```

## Per-app commands

```bash
pnpm --filter home dev             # Home on :3000
pnpm --filter home dev:no-auth     # Home without Clerk auth
pnpm --filter home build           # Verify Home build
pnpm --filter budget dev           # Budget on :3001
pnpm --filter budget dev:no-auth   # Budget without Clerk auth
pnpm --filter budget test          # Budget Vitest suite
pnpm --filter schedule dev         # Schedule on :3003 (Next.js)
pnpm --filter schedule test        # Schedule Vitest suite
pnpm --filter schedule build       # Verify Schedule build
pnpm --filter lists dev            # Lists on :3004 (SvelteKit)
pnpm --filter lists dev:no-auth    # Lists without Clerk auth
pnpm --filter lists build          # Verify Lists build
pnpm --filter api-bot dev          # Bot gateway on :3002
pnpm --filter api-bot test         # Bot gateway Vitest suite
pnpm --filter api-bot check-types  # Bot gateway TypeScript check
```

## Local development

Run the UI apps directly by port in local dev:

- Home: `http://localhost:3000`
- Budget: `http://localhost:3001`
- Schedule: `http://localhost:3003`
- Lists: `http://localhost:3004`
- Bot gateway: `http://localhost:3002`

Home proxies `/api/bot/*` to the bot gateway in local development, so the
notification settings screen can use the same path locally and in production.
Telegram pairing is only enabled when the bot gateway runs with
`VERCEL_ENV=production`; local and preview environments still support status,
unlink, notifications, and webhook testing.

## Before committing

Run `pnpm format`, `pnpm lint`, `pnpm check-types`, `pnpm test`.

## Deep dives

- [Architecture](docs/architecture.md) — monorepo layout, multi-zones, PWA scope
- [Auth](docs/auth.md) — Clerk setup
- [Deployment](docs/deployment.md) — Vercel Multi-Zones step-by-step
- [Convex backend](docs/convex-backend.md) — data model, derivation pattern
- [Frontend](docs/frontend.md) — TanStack Start, routing, styling
- [Offline strategy](docs/offline.md) — what the PWA shell does and doesn't cover
- [Testing & CI](docs/testing-and-ci.md) — test setup, CI stages
