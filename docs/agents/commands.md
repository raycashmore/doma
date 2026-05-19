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
pnpm convex        # Start Convex dev for @repo/convex
pnpm seed          # Seed Convex data
pnpm seed:clear    # Clear seeded Convex data
```

## App Commands

```bash
pnpm --filter home dev          # Home app on :3000
pnpm --filter home dev:no-auth  # Home app on :3000 without Clerk auth
pnpm --filter budget dev        # Budget app on :3001
pnpm --filter budget dev:no-auth # Budget app on :3001 without Clerk auth
pnpm --filter budget test       # Budget app Vitest suite
```
