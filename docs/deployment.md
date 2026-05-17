# Deployment

How to take Doma from `localhost` to a live deployment on Vercel.

## Background

Doma is a **Vercel Multi-Zones** setup. Each app is a separate Vercel project. One project — `apps/home` — owns the apex domain and rewrites paths to the other projects' deployment URLs. From the browser's point of view it's a single site at one domain; behind the scenes the traffic for `/budget/*` is reverse-proxied to a different Vercel project's deployment.

Why this shape:

- Independent deploys — Budget can ship a change without rebuilding Home.
- Independent frameworks — when the first non-React app lands (Svelte, whatever) it just gets its own Vercel project; the apex doesn't care.
- One cookie covers everything — same apex domain → Clerk session shared automatically across zones.

What you'll create:

| Piece                              | Where           | One per                            |
| ---------------------------------- | --------------- | ---------------------------------- |
| Convex deployment (production)     | Convex cloud    | All apps share one                 |
| Clerk application (production env) | Clerk dashboard | All apps share one                 |
| Vercel project for Home            | Vercel          | Owns the apex domain + rewrites    |
| Vercel project for Budget          | Vercel          | Lives behind a Vercel-assigned URL |
| Vercel project for each future app | Vercel          | One per app                        |

## Prerequisites

- A Vercel account, logged in via the CLI (`pnpm dlx vercel login`) or the dashboard.
- A Convex production deployment (covered below — separate from your dev deployment).
- A Clerk application with production environment configured (covered below).
- A custom domain you control (optional but recommended — Vercel's default `*.vercel.app` works too).

## Step 1 — Convex production deployment

The dev `pnpm convex` you run locally uses a development deployment. Production gets its own.

```bash
# From repo root, one-time:
pnpm --filter @repo/convex exec convex deploy --cmd 'echo "deployed"'
```

This creates a production deployment in your Convex project and prints the production deployment URL (something like `https://<name>.convex.cloud`). Save it — you'll set this as `VITE_CONVEX_URL` on Vercel.

In the Convex dashboard for the **production** deployment specifically:

- **Settings → Environment Variables**: set `CLERK_JWT_ISSUER_DOMAIN` to your **production** Clerk Frontend API URL (different from dev — see Step 2).

## Step 2 — Clerk production environment

Clerk's model: one application contains both a development environment (what you've been using on localhost) and a production environment (separate keys + separate cookie scope). Promote settings from dev to prod inside the Clerk dashboard.

1. In the Clerk dashboard, switch the environment selector at the top from "Development" to "Production". (If you've never used production, you'll be prompted to enable it.)
2. **User & Authentication**: disable public sign-up. Add yourself + your spouse manually under Users (the production env starts with an empty user list — you have to add them again).
3. **JWT Templates**: create a template named exactly `convex` (Clerk has a one-click Convex preset). The Issuer URL is the production Frontend API URL — copy it for the Convex env var above.
4. **API Keys**: copy:
   - `Publishable Key` (starts `pk_live_…`)
   - `Secret Key` (starts `sk_live_…`)
   - `Frontend API URL` (the issuer, e.g. `https://clerk.your-domain.com`)
5. **Domains**: add your apex domain (e.g. `doma.example.com`). Clerk uses this to scope cookies to the apex, which is what lets all zones share the session.

## Step 3 — Deploy Budget (do this first)

Budget needs to be live before Home can rewrite to it.

Via the Vercel CLI:

```bash
pnpm dlx vercel link --project doma-budget   # one time; creates .vercel/ in apps/budget
pnpm dlx vercel --cwd apps/budget             # preview deploy
pnpm dlx vercel --cwd apps/budget --prod      # production deploy
```

Or via the dashboard:

1. **New Project** → import your repo.
2. **Configure Project**:
   - **Root Directory**: `apps/budget`
   - **Framework Preset**: Other
   - **Build Command**: `pnpm build`
   - **Output Directory**: `.output/public` (TanStack Start + Nitro emits there)
   - **Install Command**: leave default; Vercel detects pnpm workspaces and runs install from the repo root.
3. **Environment Variables** (Production, Preview, Development as appropriate — at minimum Production):

   | Name                          | Value                                     |
   | ----------------------------- | ----------------------------------------- |
   | `VITE_CONVEX_URL`             | Convex production URL from Step 1         |
   | `VITE_CLERK_PUBLISHABLE_KEY`  | Clerk production publishable key (Step 2) |
   | `CLERK_SECRET_KEY`            | Clerk production secret key (Step 2)      |
   | `VITE_CLERK_FRONTEND_API_URL` | Clerk Frontend API URL (Step 2)           |

4. **Deploy**. When it succeeds, copy the deployment URL — it'll look like `https://doma-budget-<hash>.vercel.app`. You'll use this in Step 4.

`apps/budget/vercel.json` already has the SPA fallback rewrite. No further config needed inside the project.

## Step 4 — Deploy Home

Home owns the apex. Before deploying, point its rewrites at Budget's real URL.

1. Edit `apps/home/vercel.json`. Replace the placeholder `https://doma-budget.vercel.app` with Budget's actual production URL from Step 3:

   ```json
   {
     "rewrites": [
       {
         "source": "/budget",
         "destination": "https://doma-budget-<hash>.vercel.app/budget"
       },
       {
         "source": "/budget/:path*",
         "destination": "https://doma-budget-<hash>.vercel.app/budget/:path*"
       }
     ]
   }
   ```

   Better: point at a Vercel project alias. In Budget's Vercel project under **Domains**, add a stable internal name like `budget.<your-apex>` or use Vercel's `<project>.vercel.app` URL (no hash) and reference that in the rewrite. This way Budget's deploys don't break Home's rewrites.

2. Commit the rewrite update and push.

3. Deploy Home (same flow as Budget):

   ```bash
   pnpm dlx vercel link --project doma-home --cwd apps/home
   pnpm dlx vercel --cwd apps/home --prod
   ```

   Or via the dashboard with **Root Directory** `apps/home`.

4. **Environment Variables** on the Home project (Home doesn't talk to Convex yet, but wire the Clerk vars so the auth gate works):

   | Name                          | Value                            |
   | ----------------------------- | -------------------------------- |
   | `VITE_CLERK_PUBLISHABLE_KEY`  | Clerk production publishable key |
   | `CLERK_SECRET_KEY`            | Clerk production secret key      |
   | `VITE_CLERK_FRONTEND_API_URL` | Clerk Frontend API URL           |

## Step 5 — Attach your apex domain to Home

In the Home Vercel project → **Domains** → add your apex (`doma.example.com`). Vercel walks you through the DNS records. Once verified, the production URL becomes `https://doma.example.com`, and `/budget` reverse-proxies to Budget via the rewrite.

Add the same apex domain to your Clerk production environment (Step 2 step 5) if you haven't already — Clerk needs to know it for cookie scoping.

## Step 6 — Verify the deployment

1. Open `https://doma.example.com/` — Home renders, you see Clerk's sign-in.
2. Sign in with an allowlisted user. Home dashboard appears.
3. Click the Budget icon in the sidebar — URL becomes `https://doma.example.com/budget`.
4. Budget renders. No second sign-in (cookie shared on apex).
5. Budget's chart loads with data — Convex queries are authenticated end-to-end.
6. Open DevTools → Network. Refreshing `/budget` should show a 200 response served via Home's project; the underlying response comes from Budget's project (you'll see headers like `x-vercel-id` mentioning the Budget project, but the URL stays under the apex).

## Adding a new app later

The pattern repeats:

1. Build the new app at `apps/<name>` (or `apps/api-<name>` for non-Convex backends).
2. Deploy it as its own Vercel project with **Root Directory** `apps/<name>`.
3. Add a rewrite to `apps/home/vercel.json`:

   ```json
   {
     "source": "/<name>/:path*",
     "destination": "https://doma-<name>.vercel.app/<name>/:path*"
   }
   ```

4. Redeploy Home.
5. If the new app uses Convex, set `VITE_CONVEX_URL` + the three Clerk vars on its Vercel project. If not, just the Clerk vars.
6. Enable the app in `packages/shell/src/apps.ts` (flip `enabled: false` to `true`) and ship a shell update. The new icon appears in the sidebar.

## Environment-variable reference

| Variable                      | Where it lives                          | Used by                      | Notes                                       |
| ----------------------------- | --------------------------------------- | ---------------------------- | ------------------------------------------- |
| `VITE_CONVEX_URL`             | Vercel (per consumer app), `.env.local` | Browser-side Convex client   | Different value in dev vs production        |
| `VITE_CLERK_PUBLISHABLE_KEY`  | Vercel (every app), `.env.local`        | Browser-side Clerk SDK       | `pk_test_…` in dev, `pk_live_…` in prod     |
| `CLERK_SECRET_KEY`            | Vercel (every app), `.env.local`        | Server-side Clerk operations | Never expose to the browser                 |
| `VITE_CLERK_FRONTEND_API_URL` | Vercel (every app), `.env.local`        | Clerk JWT issuer URL         | Same in every app; one per Clerk env        |
| `CLERK_JWT_ISSUER_DOMAIN`     | Convex dashboard (per deployment)       | Convex auth.config.ts        | Same value as `VITE_CLERK_FRONTEND_API_URL` |

## Common pitfalls

- **Forgetting to update `apps/home/vercel.json` rewrites** after deploying Budget. The rewrite points at a placeholder URL by default; until you change it, `/budget` returns Vercel's "no such project" error.
- **Pointing rewrites at the hashed deployment URL** (`doma-budget-<git-sha>.vercel.app`). That URL changes per deploy. Use the project's stable alias (`doma-budget.vercel.app`) or a custom subdomain instead.
- **Convex env var `CLERK_JWT_ISSUER_DOMAIN` not set** in the production Convex dashboard. Symptoms: queries return 401, browser console shows `Unauthorized` from Convex. Fix in the Convex dashboard → restart `pnpm convex` if you have it running locally against prod.
- **Clerk cookie scoped to the wrong domain**. The production Clerk env needs your apex added under **Domains**. Without it, the cookie is set on Clerk's own subdomain and zones can't see it.
- **Different Convex deployments for dev vs prod sharing schema state**. They don't. Schema migrations apply per deployment — when you deploy Convex to production, push the same schema you're running in dev.
- **Build failing on Vercel with "module not found"** for a `@repo/*` workspace package. Check Vercel's "Install Command" — it should run `pnpm install` from the repo root (default). If you set it to install from `apps/<name>` only, workspace symlinks won't resolve.
- **PWA service worker caching old assets across deploys**. `vite-plugin-pwa` is configured with `registerType: 'autoUpdate'` so this shouldn't bite, but if you see stale UI after a deploy, do a hard refresh once to force the new SW to take over.

## Rollback

Each Vercel project has its own deploy history. Roll back via the dashboard (Deployments → … → "Promote to Production" on the prior good one) per app. Rolling back Home alone is safe (rewrites still point at Budget's then-current deploy); rolling back Budget alone is also safe (Home's rewrite finds whatever Budget has live).

If a schema change in Convex needs reverting, do that from the Convex dashboard — Convex versions deploys.
