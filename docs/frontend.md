# Frontend

## Frameworks

The frontend is intentionally multi-framework. Home is a client-side Vue 3 SPA with Vue Router. Budget and Meals use TanStack Start with React 19, Schedule uses Next.js, and Lists uses SvelteKit. Shared cross-framework UI contracts belong in `@repo/app-registry` and `@repo/tokens`; `@repo/shell` and `@repo/ui` remain React-only.

## React-zone styling

- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (NOT PostCSS — do not add `postcss.config.js`)
- **Shadcn UI:** new-york style, zinc base color, components at `@/components/ui/`
- **Class merging:** Use `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- **Icons:** Lucide React (`lucide-react`)

Home uses plain CSS backed by `@repo/tokens` and Lucide Vue (`@lucide/vue`). It does not import Tailwind, shadcn, or React UI packages.

## React Compiler

Enabled via `babel-plugin-react-compiler`. Skip manual `useMemo`/`useCallback` — the compiler handles memoization automatically.

## React component locations

| Path               | Purpose                     |
| ------------------ | --------------------------- |
| `@/components/ui/` | Shadcn UI primitives        |
| `@/components/`    | Custom app components       |
| `@repo/ui/button`  | Shared cross-app components |

## Convex Integration

React zones configure Convex in their root route. Home retains `convex-vue` behind Home-local composables and configures its underlying client with Clerk's `convex` JWT template. Lists uses its native Svelte integration.

## Home

`apps/home` owns the apex Vue shell, household noticeboard, notification settings, Vercel child-zone rewrites, and root service-worker boundary. Its active board loads a household-timezone Today summary and independently resolved school lunch and dinner values from `api.home.activeBoard.activeBoard`; local no-auth mode uses generic fixtures. Routes live in `src/router.ts`; auth and Convex integration live under `src/integrations/`. See `apps/home/README.md` for the adapter decision and local commands.

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
