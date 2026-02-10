# Doma

Domestic management system

## What This Does

Doma automates manual domestic tasks like financial tracking, shared calendars, and chore management.

## Architecture

```
doma/
├── apps/
│   ├── web/          TanStack Start — main app (port 3000)
│   └── docs/         Next.js — documentation (port 3001)
├── packages/
│   ├── ui/           Shared React components (@repo/ui)
│   ├── eslint-config/
│   └── typescript-config/
├── data/             Convex schema, queries, mutations, seed scripts
└── docs/             Topic guides
```

**Turborepo monorepo** with **pnpm** as the package manager.

### Frontend

**TanStack Start** with React 19, file-based routing, and server-side rendering. Styled with Tailwind CSS v4.

### Backend

**Convex** real-time backend

### Data Model

Replacing manual spreadsheet tracking

## Getting Started

```bash
pnpm install
```

Start the Convex dev server and all apps:

```bash
pnpm convex   # local Convex backend
pnpm dev      # all apps via Turbo
```

The web app requires a `VITE_CONVEX_URL` environment variable pointing to the Convex instance.

## Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Framework  | TanStack Start, TanStack Router         |
| UI         | React 19, Tailwind CSS v4, Lucide icons |
| Backend    | Convex (real-time, schema-first)        |
| Validation | Zod v4                                  |
| Monorepo   | Turborepo, pnpm workspaces              |
| Docs       | Next.js                                 |
| Testing    | Vitest                                  |
