# Architecture

Doma is a Vercel Multi-Zones monorepo. `apps/home` owns the apex domain and rewrites paths to other Vercel projects. Each sub-app is independent: its own framework, build, and deploy.

## Monorepo layout

| Path                         | Framework            | Notes                                                                        |
| ---------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `apps/home`                  | TanStack Start       | Apex zone, port 3000; owns `vercel.json` rewrites                            |
| `apps/budget`                | TanStack Start       | Mounts at `/budget`, port 3001                                               |
| `apps/schedule`              | Next.js (App Router) | Mounts at `/schedule`, port 3003                                             |
| `apps/lists`                 | SvelteKit            | Mounts at `/lists`, port 3004; native Svelte shell using shared tokens       |
| `apps/meals`                 | TanStack Start       | Mounts at `/meals`, port 3005; household cookbook and weekday planning zone  |
| `apps/api-bot`               | Hono on Vercel       | Shared bot gateway for Telegram delivery and chat                            |
| `apps/api-agent`             | Hono + Vercel AI SDK | Inspectable, independently deployed AI agents; port 3006                     |
| `apps/api-*`                 | (per-experiment)     | Convention for non-Convex backends                                           |
| `packages/convex`            | —                    | Shared Convex schema/functions (`@repo/convex`)                              |
| `packages/app-registry`      | —                    | Framework-neutral app metadata and navigation helpers (`@repo/app-registry`) |
| `packages/tokens`            | —                    | Tailwind v4 design tokens (`@repo/tokens`)                                   |
| `packages/shell`             | React                | Shared Sidebar + AppFrame + MobileNav + auth context (`@repo/shell`)         |
| `packages/ui`                | React                | Shadcn primitives (`@repo/ui`)                                               |
| `packages/eslint-config`     | —                    | Shared ESLint configs                                                        |
| `packages/typescript-config` | —                    | Shared TypeScript configs                                                    |

## Multi-Zones

`apps/home/vercel.json` rewrites paths to other Vercel projects. TanStack Start sub-apps build with `base: '/<path>/'` (Vite) plus `basepath: '/<path>'` (TanStack Router) so asset URLs and route matching agree. Next.js sub-apps (e.g. `schedule`) achieve the same with `basePath` set to the mount path — **in production only**, unset in dev — so cross-port dev links to `localhost:<port>/` still resolve. (Next derives the asset prefix from `basePath`, so assets serve under the mount path without a separate `assetPrefix`.) SvelteKit sub-apps (e.g. `lists`) use `kit.paths.base` in production and an empty base in dev for the same reason. Cross-app navigation is real browser navigation; same apex domain means a single Clerk cookie covers every zone.

**Local dev does not apply Vercel rewrites.** Each app runs on its own port (Home 3000, Budget 3001, Bot gateway 3002, Schedule 3003, Lists 3004, Meals 3005, Agent API 3006). Visit UI apps directly. Home proxies `/api/bot/*` to the bot gateway, while Meals proxies `/api/agent/*` to the agent service, preserving the production same-origin request shape.

### Cross-origin Clerk session sync in dev

Each dev port is a separate browser origin, so Clerk's session cookie doesn't carry across them. Each app's `AuthGate` adapter feeds Clerk's `buildUrlWithAuth` into the shell's `UrlAuthProvider`; `Sidebar` and `MobileNav` consume it via `useUrlAuth()` to append a short-lived `__clerk_db_jwt` to cross-origin links — clicking the Budget icon while signed in on Home lands you on Budget already authed. The app metadata and URL helpers live in the framework-neutral `@repo/app-registry` package; the React shell attaches icons and auth-link behavior on top. The context lives in `packages/shell/src/auth.tsx` (`UrlAuthContext`); the Clerk wiring lives in each app (Budget uses `@clerk/clerk-react`, Schedule uses `@clerk/nextjs`). In production all zones share the apex cookie and the URL builder is a no-op for same-origin paths.

_A Caddy reverse-proxy was explored as an alternative (single origin → one cookie), but TanStack Start + Nitro + Vite's `base` option don't play well together: `/<base>/@react-refresh`, `/<base>/@vite/client`, `/<base>/@id/...` all 404 in dev even with `base` set, breaking the proxy approach. The `clerk.buildUrlWithAuth` route is simpler and doesn't fight the framework._

When new sub-apps land, add rewrite entries to `apps/home/vercel.json`:

```json
{
  "source": "/<app>/:path*",
  "destination": "https://doma-<app>.vercel.app/<app>/:path*"
}
```

## Backend services convention

`apps/api-bot` is the shared channel gateway for notifications and inbound chat. It owns provider-specific webhook and send APIs, while app capabilities stay behind HTTP contracts and may use Convex or another backend. Telegram is the first provider; the app-facing boundary should remain provider-neutral so WhatsApp or another channel can be added later.

Non-Convex backend experiments live at `apps/api-<name>` (e.g. `apps/api-recipes-import`). Each is its own Vercel project. To expose one to the frontend, add a rewrite under `apps/home/vercel.json`:

```json
{
  "source": "/api/<name>/:path*",
  "destination": "https://doma-api-<name>.vercel.app/:path*"
}
```

Convex remains the primary backend — most data and business logic belong there. `apps/api-*` is for experiments that don't fit Convex's model (long-running jobs, webhook receivers, framework playgrounds).

`apps/api-agent` is the first durable instance of that convention. Its
`agents/weekly-meals/` module owns a bounded AI SDK `ToolLoopAgent`, strict
read-only planning tools, typed outcomes, post-generation validation, and
privacy-safe traces. Convex remains authoritative: it supplies tool context,
stores traces for 30 days, and atomically rejects stale or tampered proposals
when Meals applies a reviewed run. The agent never writes Lists or infers
leftovers. Schedule ingestion caches the current and following week so the
agent's target-week busyness is date-correct while the Schedule UI remains a
current-week view.

## PWA

TanStack Start apps use `vite-plugin-pwa` with `scope` set to their mount path; each is independently installable. The service worker scope must match the rewrite shape — Budget's SW lives at `/budget/sw.js`, registered when the user visits `/budget`. The Next.js `schedule` app will use Serwist (`@serwist/next`) for the same effect — its PWA layer lands in a later phase. See `docs/offline.md` for what's covered (shell) and what isn't (offline data).

## Auth

Clerk per zone, restricted-mode allowlist. The Clerk cookie is set on the apex domain, so every zone shares the session. React apps own an `AuthGate` adapter (`apps/<app>/src/integrations/auth/AuthGate.tsx`) that wraps their Clerk SDK and composes `@repo/shell`'s `UrlAuthProvider` + `SignInLayout`. Lists uses Clerk's browser SDK from its native Svelte layout instead of importing the React shell package. Gates are a passthrough until the app's Clerk publishable key is set (`VITE_CLERK_PUBLISHABLE_KEY` for Vite/SvelteKit apps, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for Next.js), then become sign-in gates. See `docs/auth.md`.

## Path aliases

- `@/` maps to `<app>/src/` per app

## Generated Files — Never Edit

- `packages/convex/convex/_generated/` — Convex types and API (regenerated by `pnpm convex`)
- `apps/<app>/src/routeTree.gen.ts` — TanStack Router route tree (regenerated on dev)
- `apps/schedule/next-env.d.ts` and `apps/schedule/.next/` — generated by Next.js (git-ignored)
