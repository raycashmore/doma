# Architecture

Doma is a Vercel Multi-Zones monorepo. `apps/home` owns the apex domain and rewrites paths to other Vercel projects. Each sub-app is independent: its own framework, build, and deploy.

## Monorepo layout

| Path                         | Framework            | Notes                                                                        |
| ---------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `apps/home`                  | Vue 3 + Vite         | Apex SPA, port 3000; owns `vercel.json` rewrites                             |
| `apps/budget`                | TanStack Start       | Mounts at `/budget`, port 3001                                               |
| `apps/schedule`              | Next.js (App Router) | Mounts at `/schedule`, port 3003                                             |
| `apps/lists`                 | SvelteKit            | Mounts at `/lists`, port 3004; native Svelte shell using shared tokens       |
| `apps/meals`                 | TanStack Start       | Mounts at `/meals`, port 3005; household cookbook and weekday planning zone  |
| `apps/android`               | Kotlin + Gradle      | Sideloaded companion and Glance list widget; outside Turbo and Vercel        |
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

Each dev port is a separate browser origin, so Clerk's session cookie doesn't carry across them. Every app feeds Clerk's `buildUrlWithAuth` into its navigation layer to append a short-lived `__clerk_db_jwt` to cross-origin links — clicking the Budget icon while signed in on Home lands you on Budget already authed. The app metadata and URL helpers live in the framework-neutral `@repo/app-registry` package. React apps use `@repo/shell`'s `UrlAuthProvider`; Home's native Vue shell calls the same Clerk builder directly. In production all zones share the apex cookie and the URL builder is a no-op for same-origin paths.

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

### Android widget delivery

`apps/android` is an independent native companion, not a Vercel zone or pnpm
workspace package. It uses the same Clerk `convex` JWT template as the PWAs to
query the narrow Convex widget projection. Its encrypted app-private state holds
only its installation ID, per-widget list selections, and last successful
snapshots. Convex stores the current FCM token per authenticated installation,
then sends only an opaque invalidation signal; Android refetches its own selected
lists. A 15-minute WorkManager refresh is the delivery fallback.

### Home noticeboard composition

Home is a read model over existing domain owners. The `home/activeBoard` query resolves Today, Meals, forwarded-email notices, spending insights, and manual notes for the signed-in user, then filters expired, superseded, and archived occurrences. It does not copy source payloads into a Home-owned projection. `manualNotes` is the only Home-authored content table; `boardArchives` contains only an occurrence id, source kind, archiving user id, and archive timestamp. This keeps ownership explicit while Convex subscriptions provide cross-client updates.

`apps/api-agent` is the first durable instance of that convention. Its
`agents/weekly-meals/` module owns a bounded AI SDK `ToolLoopAgent`, strict
read-only planning tools, typed outcomes, post-generation validation, and
privacy-safe traces. Convex remains authoritative: it supplies tool context,
stores traces for 30 days, and atomically rejects stale or tampered proposals
when Meals applies a reviewed run. The agent never writes Lists or infers
leftovers. Schedule ingestion caches the current and following week so the
agent's target-week busyness is date-correct while the Schedule UI remains a
current-week view.

Forwarded-email inference also lives in `apps/api-agent`. Convex exposes only a
currently claimed capture through a dedicated service-token boundary, stores
the typed outcome and trace, and owns the deterministic lifecycle and reminder
policy. Agent judgement is bounded to typed, grounded candidates: Convex
calculates expiry arithmetic deterministically as it persists a new notice from
the typed obligation or relevance outcome, using a fourteen-day fallback when
neither is grounded. Legacy notices do not store relevance; their backfill uses
the stored obligation with deliberately low, empty relevance and the same
fallback. High-confidence supersession is applied atomically with creation of
the replacement notice. Home continues to render the canonical `emailNotices`
rows; the agent does not own a second noticeboard projection.

## PWA

Vite apps use `vite-plugin-pwa` with `scope` set to their mount path; each is independently installable. Home's root-scoped worker precaches the Home shell but excludes `/api`, `/budget`, `/schedule`, `/lists`, and `/meals` navigations from its fallback. Those exclusions mirror the rewrites that precede Home's final SPA fallback in `apps/home/vercel.json`. Convex traffic is network-only. The service worker scope must match the rewrite shape — Budget's SW lives at `/budget/sw.js`, registered when the user visits `/budget`. The Next.js `schedule` app will use Serwist (`@serwist/next`) for the same effect — its PWA layer lands in a later phase. See `docs/offline.md` for what's covered (shell) and what isn't (offline data).

## Auth

Clerk per zone, restricted-mode allowlist. The Clerk cookie is set on the apex domain, so every zone shares the session. React apps own an `AuthGate` adapter that composes `@repo/shell`; Home uses `@clerk/vue` in its native Vue gate, and Lists uses Clerk's browser SDK in its Svelte layout. Gates are a passthrough only in the apps' explicit local no-auth modes. See `docs/auth.md`.

## Path aliases

- `@/` maps to `<app>/src/` per app

## Generated Files — Never Edit

- `packages/convex/convex/_generated/` — Convex types and API (regenerated by `pnpm convex`)
- `apps/{budget,meals}/src/routeTree.gen.ts` — TanStack Router route tree (regenerated on dev)
- `apps/schedule/next-env.d.ts` and `apps/schedule/.next/` — generated by Next.js (git-ignored)
