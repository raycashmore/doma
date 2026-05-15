# Doma

Personal finance dashboard — Turborepo monorepo, `pnpm`, Convex real-time backend.

## Commands

```bash
pnpm dev           # Start all apps (turbo)
pnpm build         # Build all apps
pnpm lint          # Lint all apps
pnpm check-types   # TypeScript type checking
pnpm format        # Format with Prettier
pnpm convex        # Convex dev server

# apps/budget only
pnpm test          # Vitest
pnpm check         # Format + lint fix
```

## Before Committing

Run `pnpm format` and ensure `pnpm lint`, `pnpm check-types`, and `pnpm test` pass.

## Deep Dives

- [Architecture](docs/architecture.md) — monorepo layout, packages, shared configs
- [Convex Backend](docs/convex-backend.md) — data model, derivation pattern, schema rules
- [Frontend](docs/frontend.md) — TanStack Start, routing, components, styling
- [Testing & CI](docs/testing-and-ci.md) — test setup, CI pipeline stages
