# Doma

Personal finance dashboard — Turborepo monorepo deployed as Vercel Multi-Zones, with Convex real-time backend and Clerk auth.

## Commands

```bash
pnpm dev           # Start all apps (turbo)
pnpm build         # Build all apps
pnpm lint          # Lint all apps
pnpm check-types   # TypeScript type checking
pnpm format        # Format with Prettier
pnpm convex        # Convex dev (regenerates packages/convex/convex/_generated)
```

## App-specific commands

```bash
pnpm --filter home dev        # Home on :3000
pnpm --filter budget dev      # Budget on :3001
pnpm --filter budget test     # Vitest
```

## Before Committing

Run `pnpm format` and ensure `pnpm lint`, `pnpm check-types`, and `pnpm test` pass.

## Deep Dives

- [Architecture](docs/architecture.md) — multi-zones layout, packages, deploy
- [Auth](docs/auth.md) — Clerk setup
- [Deployment](docs/deployment.md) — Vercel Multi-Zones step-by-step
- [Convex Backend](docs/convex-backend.md) — schema, queries, derivation pattern
- [Frontend](docs/frontend.md) — TanStack Start, routing, components, styling
- [Offline strategy](docs/offline.md) — what the PWA shell does and doesn't cover
- [Testing & CI](docs/testing-and-ci.md) — test setup, CI pipeline stages
