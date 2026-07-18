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
the React `@repo/shell` package. Cross-app navigation comes from the shared
`@repo/app-registry` metadata so Lists stays aligned with the React shell without
importing React. The scaffold renders a fixture-backed Lists screen with the
first-version layout shape: list picker, central item pane, and item detail
space.

For visual work without a Clerk session, run `pnpm --filter lists dev:no-auth`.

## Meals

`apps/meals` is a TanStack Start zone mounted at `/meals`. It follows the
Budget zone's base-path, Clerk, Convex, shared-shell, tokens, and PWA patterns,
and runs locally on port 3005. The zone owns cookbook UI only; its recipe data
comes from `packages/convex/convex/meals/`, while Lists remains the shopping
item owner.

The cookbook collection, detail, create, and edit screens use the approved
Pencil frames as their visual source. The collection supports search and
suitability filters; recipe forms preserve ordered free-form ingredients. The
responsive `/meals/week` route assigns recipes to Monday-to-Friday school lunch
and dinner slots, persists manual changes, and derives a reviewable shopping
review from the recipes' exact ingredient lines. The Suggest meals flow accepts
an optional one-off instruction, shows the agent's grounded reasons for review,
and batch-fills empty slots only. Suggestions are offered for the current and
following week, matching the schedule cache's bounded planning horizon. Lists
handoff copies the exact reviewed shopping rows, including repeats, into the
single shared list named `Shopping` after the user explicitly selects
**Send to Lists**.

Local no-auth development uses generic persisted fixtures, while production
requires Clerk and Convex and fails closed when either is missing.
