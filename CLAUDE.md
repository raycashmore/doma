# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # Start all apps in development mode (turbo)
pnpm convex           # Run Convex dev server (npx convex dev)

# Building & Linting
pnpm build            # Build all apps
pnpm lint             # Lint all apps
pnpm check-types      # TypeScript type checking
pnpm format           # Format code with Prettier

# Web app specific (run from apps/web)
pnpm test             # Run vitest tests
pnpm check            # Format + lint fix
```

## Architecture

This is a Turborepo monorepo with pnpm workspaces.

### Apps

- **apps/web**: Main application built with TanStack Start (Vite + React 19 + TanStack Router). Uses file-based routing in `src/routes/`. Runs on port 3000.
- **apps/docs**: Next.js 16 documentation site. Runs on port 3001.

### Packages

- **packages/ui**: Shared React component library (`@repo/ui`). Import components as `@repo/ui/button`.
- **packages/eslint-config**: Shared ESLint configurations (`@repo/eslint-config`)
- **packages/typescript-config**: Shared TypeScript configs (`@repo/typescript-config`)

### Backend

- **Convex**: Real-time backend. Schema in `apps/web/convex/schema.ts`. Root `convex/` directory exists but is empty (setup pending).
- Requires `VITE_CONVEX_URL` environment variable

### Key Technologies in apps/web

- TanStack Start with Nitro server
- TanStack AI (Anthropic integration) for AI features
- React Compiler (babel-plugin-react-compiler)
- Tailwind CSS v4
- Sentry for error tracking and instrumentation
- Path alias: `@/` maps to `src/`

## Convex Guidelines

When defining Convex schemas:

- Use `v.id("tableName")` for foreign keys
- System fields `_id` and `_creationTime` are automatic
- Define indexes with `.index("indexName", ["field1", "field2"])`
- Use `v.optional()` for nullable fields
- Use `v.union()` with `v.literal()` for discriminated unions

## Sentry Instrumentation

Wrap server functions with Sentry spans:

```tsx
import * as Sentry from '@sentry/tanstackstart-react';

Sentry.startSpan({ name: 'Operation name' }, async () => {
  // async operation
});
```

## Adding shadcn Components

```bash
pnpm dlx shadcn@latest add <component>
```
