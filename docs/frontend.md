# Frontend

## Framework

TanStack Start with React 19. File-based routing via TanStack Router — routes live in `src/routes/`, root layout in `__root.tsx`.

## Styling

- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (NOT PostCSS — do not add `postcss.config.js`)
- **Shadcn UI:** new-york style, zinc base color, components at `@/components/ui/`
- **Class merging:** Use `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- **Icons:** Lucide React (`lucide-react`)

## React Compiler

Enabled via `babel-plugin-react-compiler`. Skip manual `useMemo`/`useCallback` — the compiler handles memoization automatically.

## Component Locations

| Path               | Purpose                     |
| ------------------ | --------------------------- |
| `@/components/ui/` | Shadcn UI primitives        |
| `@/components/`    | Custom app components       |
| `@repo/ui/button`  | Shared cross-app components |

## Convex Integration

`ConvexProvider` wraps the app in `__root.tsx`, configured in `src/integrations/convex/`.

## Schedule

`apps/schedule` is a Next.js App Router app mounted as the Schedule zone. Its
main page renders a read-only weekly swimlanes view from
`api.schedule.queries.currentWeek` and calls `api.schedule.sync.refresh` on load
and from the manual refresh button. Events link back to Google Calendar for
edits; the app does not create or edit calendar events.

For visual work without a Clerk session, run `pnpm --filter schedule dev:no-auth`.
That mode uses generic fixture events and keeps real family schedule details out
of committed code.

## Lists

`apps/lists` is a SvelteKit app mounted as the Lists zone. It uses shared Doma
tokens directly and keeps a native Svelte shell layout rather than depending on
the React `@repo/shell` package. The scaffold renders a fixture-backed Lists
screen with the first-version layout shape: list picker, central item pane, and
item detail space.

For visual work without a Clerk session, run `pnpm --filter lists dev:no-auth`.
