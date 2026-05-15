# Doma

Personal finance dashboard — Turborepo monorepo deployed as Vercel Multi-Zones.

## Apps

- `apps/home` — apex zone, summary/landing (port 3001)
- `apps/budget` — Budget app at `/budget` (port 3000)
- `apps/api-*` — convention for non-Convex backend experiments (none scaffolded)

## Packages

- `@repo/convex` — shared Convex schema/functions
- `@repo/tokens` — design tokens (Tailwind v4)
- `@repo/shell` — shared React sidebar + AppFrame + AuthGate
- `@repo/ui` — shared React primitives

## Commands

```bash
pnpm dev           # Start all apps (turbo)
pnpm build         # Build all apps
pnpm lint          # Lint everywhere
pnpm check-types   # TypeScript across the workspace
pnpm format        # Prettier
pnpm convex        # Convex dev (regenerates packages/convex/convex/_generated)
```

## Per-app commands

```bash
pnpm --filter budget dev      # Budget on :3000/budget
pnpm --filter budget test     # Vitest
pnpm --filter home dev        # Home on :3001
```

## Before committing

Run `pnpm format`, `pnpm lint`, `pnpm check-types`, `pnpm test`.

## Deep dives

- [Architecture](docs/architecture.md) — monorepo layout, multi-zones, PWA scope
- [Auth](docs/auth.md) — Clerk setup
- [Convex backend](docs/convex-backend.md) — data model, derivation pattern
- [Frontend](docs/frontend.md) — TanStack Start, routing, styling
- [Offline strategy](docs/offline.md) — what the PWA shell does and doesn't cover
- [Testing & CI](docs/testing-and-ci.md) — test setup, CI stages
