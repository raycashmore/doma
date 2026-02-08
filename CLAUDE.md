# CLAUDE.md

Turborepo monorepo. Package manager: `pnpm`.

## Commands

```bash
pnpm dev           # Start all apps (turbo)
pnpm build         # Build all apps
pnpm lint          # Lint all apps
pnpm check-types   # TypeScript type checking
pnpm format        # Format with Prettier
pnpm convex        # Convex dev server

# apps/web only
pnpm test          # Vitest
pnpm check         # Format + lint fix
```

## Structure

- **apps/web**: TanStack Start — port 3000. Path alias: `@/` → `src/`
- **apps/docs**: Next.js — port 3001
- **packages/ui**: Shared components (`@repo/ui`). Import as `@repo/ui/button`.

## Backend

Convex real-time backend. Requires `VITE_CONVEX_URL` env var.

## Before Committing

Run `pnpm format` and ensure `pnpm lint` and `pnpm test` passes.

## Topic Guides

- [Sentry instrumentation](docs/SENTRY.md)
