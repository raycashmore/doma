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
| Convex deployment (staging)        | Convex cloud    | All apps share one                 |
| Convex deployment (production)     | Convex cloud    | All apps share one                 |
| Clerk application (production env) | Clerk dashboard | All apps share one                 |
| Vercel project for Home            | Vercel          | Owns the apex domain + rewrites    |
| Vercel project for Budget          | Vercel          | Lives behind a Vercel-assigned URL |
| Vercel project for Schedule        | Vercel          | Lives behind a Vercel-assigned URL |
| Vercel project for Bot gateway     | Vercel          | Receives Telegram webhooks + sends |
| Vercel project for each future app | Vercel          | One per app                        |

## Prerequisites

- A Vercel account, logged in via the CLI (`pnpm dlx vercel login`) or the dashboard.
- A Convex staging deployment and Convex production deployment (both separate from your dev deployment).
- A Clerk application with production environment configured (covered below).
- A custom domain you control (optional but recommended — Vercel's default `*.vercel.app` works too).

## Step 1 — Convex staging and production deployments

The dev `pnpm convex` you run locally uses a development deployment. Staging and production each get their own stable cloud deployment.

```bash
# From repo root, one-time per cloud environment:
pnpm --filter @repo/convex exec convex deploy --cmd 'echo "deployed"'
```

Create one deployment for staging and one for production. Each command prints a deployment URL (something like `https://<name>.convex.cloud`). Save both — you will set them as `VITE_CONVEX_URL` in the matching environments.

In the Convex dashboard for each cloud deployment:

- **Settings → Environment Variables**: set `CLERK_JWT_ISSUER_DOMAIN` to the Clerk Frontend API URL for that environment.

### Schedule ingestion (Google Calendar)

The `schedule` app's Convex backend syncs a family's Google calendars via a service account on demand (the app triggers a refresh on load and via a manual button — no cron). It reads four additional Convex env vars: `GOOGLE_SA_KEY`, `SCHEDULE_CALENDARS`, `SCHEDULE_MEMBERS`, and `SCHEDULE_TZ`. These hold real names and calendar ids, so they live only in Convex env — never in git. Setup steps are in [`docs/schedule-ingestion-setup.md`](schedule-ingestion-setup.md).

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

## Step 3 — Configure staging and Vercel Preview

Use a stable staging Convex deployment for realistic pre-production data checks. Vercel Preview deployments can point at that staging backend.

For Vercel Preview on Budget, set:

| Name                          | Value                          |
| ----------------------------- | ------------------------------ |
| `VITE_CONVEX_URL`             | Convex staging URL from Step 1 |
| `VITE_CLERK_PUBLISHABLE_KEY`  | Clerk preview publishable key  |
| `CLERK_SECRET_KEY`            | Clerk preview secret key       |
| `VITE_CLERK_FRONTEND_API_URL` | Clerk preview Frontend API URL |

For Vercel Preview on Home, set:

| Name                          | Value                          |
| ----------------------------- | ------------------------------ |
| `VITE_CLERK_PUBLISHABLE_KEY`  | Clerk preview publishable key  |
| `CLERK_SECRET_KEY`            | Clerk preview secret key       |
| `VITE_CLERK_FRONTEND_API_URL` | Clerk preview Frontend API URL |

For Vercel Preview on Schedule, set the same values but under **Next.js public names** (Next inlines `NEXT_PUBLIC_`-prefixed vars at build; the `VITE_` prefix is Vite-only):

| Name                                | Value                          |
| ----------------------------------- | ------------------------------ |
| `NEXT_PUBLIC_CONVEX_URL`            | Convex staging URL from Step 1 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk preview publishable key  |
| `CLERK_SECRET_KEY`                  | Clerk preview secret key       |

For Vercel Preview on the Bot gateway, set the same Clerk server credentials plus the bot gateway variables from [Bot Gateway Environment](#bot-gateway-environment). Use preview Telegram bots and preview Upstash databases where possible.

If the Vercel Preview environment uses a temporary Convex deployment, seed that
deployment by passing its current Convex URL:

```bash
pnpm seed:url -- https://<preview>.convex.cloud
```

The command runs locally and read a local excel spreadsheet. It
clears seedable tables on the target deployment before inserting workbook data,
so confirm the URL before running it.

## Step 4 — Deploy Budget (do this first)

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

4. **Deploy**. When it succeeds, confirm the project also has a stable alias such as `https://doma-budget.vercel.app`. Use that stable alias for rewrites instead of the hashed deployment URL.

`apps/budget/vercel.json` already has the SPA fallback rewrite. No further config needed inside the project.

## Step 5 — Deploy Bot Gateway

The bot gateway needs to be live before Home's notification settings can create Telegram pairing links.

Via the Vercel CLI:

```bash
pnpm dlx vercel link --project doma-api-bot --cwd apps/api-bot
pnpm dlx vercel --cwd apps/api-bot
pnpm dlx vercel --cwd apps/api-bot --prod
```

Or via the dashboard:

1. **New Project** → import your repo.
2. **Configure Project**:
   - **Root Directory**: `apps/api-bot`
   - **Framework Preset**: Other
   - **Build Command**: `pnpm build`
   - **Output Directory**: leave unset
   - **Install Command**: leave default; Vercel detects pnpm workspaces and runs install from the repo root.
3. Set the variables in [Bot Gateway Environment](#bot-gateway-environment).
4. Deploy. When it succeeds, confirm the project has a stable alias such as `https://doma-api-bot.vercel.app`.
5. Register Telegram's webhook using the commands below. Vercel deploys do not do this for you.

`apps/api-bot/vercel.json` rewrites all incoming paths to its Hono handler, so `/linking/*`, `/notifications/*`, `/telegram/*`, and `/health` are served by the same app.

### Register Telegram webhook

Telegram will not send inbound messages to the bot gateway until its webhook URL
is registered with Bot API. If `getWebhookInfo` returns `"url": ""`, Telegram
is not delivering updates anywhere.

From the repo root, register the webhook using the local `.env.local` bot token
and webhook secret. Replace the URL if the deployed bot origin is different:

```bash
pnpm --filter api-bot exec dotenv -e ../../.env.local -- sh -c 'curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" -d "url=https://bot.rayandromana.com/telegram/webhook" -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"'
```

Then verify Telegram stored it:

```bash
pnpm --filter api-bot exec dotenv -e ../../.env.local -- sh -c 'curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"'
```

Expected shape:

```json
{
  "ok": true,
  "result": {
    "url": "https://bot.rayandromana.com/telegram/webhook",
    "pending_update_count": 0
  }
}
```

If Telegram still shows an empty or old `url`, re-run `setWebhook`. If
`last_error_message` is present, fix that before testing from Telegram; it is
Telegram's record of the last failed delivery attempt.

## Step 6 — Deploy Home

Home owns the apex. Before deploying, point its rewrites at Budget's real URL and the Bot gateway's real URL.

1. Edit `apps/home/vercel.json` only if the stable Budget or Bot gateway aliases change. Prefer stable destinations such as `https://doma-budget.vercel.app` and `https://doma-api-bot.vercel.app`:

   ```json
   {
     "rewrites": [
       {
         "source": "/api/bot/:path*",
         "destination": "https://doma-api-bot.vercel.app/:path*"
       },
       {
         "source": "/budget",
         "destination": "https://doma-budget.vercel.app/budget"
       },
       {
         "source": "/budget/:path*",
         "destination": "https://doma-budget.vercel.app/budget/:path*"
       }
     ]
   }
   ```

   Better: point at Vercel project aliases. In each downstream Vercel project under **Domains**, add a stable internal name like `budget.<your-apex>` or `api-bot.<your-apex>`, or use Vercel's `<project>.vercel.app` URL (no hash) and reference that in the rewrite. This way downstream deploys do not break Home's rewrites.

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

## Step 7 — Configure domains and DNS

Pick a domain layout before you touch DNS. A good default is:

| Purpose                    | Example                    | Points to |
| -------------------------- | -------------------------- | --------- |
| Apex production site       | `doma.example.com`         | Home      |
| Stable Budget alias        | `budget.doma.example.com`  | Budget    |
| Stable Bot gateway alias   | `api-bot.doma.example.com` | Bot       |
| Optional www redirect      | `www.doma.example.com`     | Home      |
| Optional staging app alias | `staging.doma.example.com` | Home      |

The important distinction:

- the **apex** is the user-facing production entry point
- the **Budget subdomain** is an internal stable target for Home rewrites
- the **Bot gateway subdomain** is the direct webhook target for Telegram and the internal target for Home's `/api/bot/*` rewrite
- Vercel Preview deploy URLs stay ephemeral and do not need custom DNS

### DNS record patterns

Your DNS provider UI may call these records slightly different things, but the patterns are usually:

| Host / Name   | Type                     | Typical target                                  | Used for                   |
| ------------- | ------------------------ | ----------------------------------------------- | -------------------------- |
| `doma` or `@` | `A`, `ALIAS`, or `ANAME` | Vercel apex target from the dashboard           | Home apex                  |
| `budget`      | `CNAME`                  | Vercel subdomain target from the Budget project | Stable Budget alias        |
| `api-bot`     | `CNAME`                  | Vercel subdomain target from the Bot project    | Stable Bot gateway alias   |
| `www`         | `CNAME`                  | Vercel subdomain target from the Home project   | Optional redirect or alias |

Two practical notes:

1. Apex domains often cannot use a plain `CNAME` record. Many DNS providers solve this with `ALIAS`, `ANAME`, or CNAME flattening. Follow the exact record type Vercel shows for your provider.
2. Subdomains like `budget.doma.example.com` usually can use a normal `CNAME`, which makes them a good fit for stable internal routing targets.

### Recommended setup order

1. Add `budget.doma.example.com` to the Budget Vercel project first.
2. Create the DNS record Vercel asks for.
3. Wait for Vercel to verify the subdomain.
4. Update `apps/home/vercel.json` to rewrite `/budget` to `https://budget.doma.example.com/budget`.
5. Add `api-bot.doma.example.com` to the Bot gateway Vercel project.
6. Create the DNS record Vercel asks for.
7. Wait for Vercel to verify the subdomain.
8. Update `apps/home/vercel.json` to rewrite `/api/bot/*` to `https://api-bot.doma.example.com/:path*`.
9. Add `doma.example.com` to the Home Vercel project.
10. Create the DNS record Vercel asks for for the apex.
11. Wait for Vercel to verify the apex.
12. Add `doma.example.com` to Clerk Production under **Domains**.

This order matters because it lets Home point at stable downstream destinations before the apex goes live.

## Step 8 — Attach your apex domain to Home

In the Home Vercel project → **Domains** → add your apex (`doma.example.com`). Vercel walks you through the DNS records. Once verified, the production URL becomes `https://doma.example.com`, and `/budget` reverse-proxies to Budget via the rewrite.

Add the same apex domain to your Clerk production environment (Step 2 step 5) if you haven't already — Clerk needs to know it for cookie scoping.

If you use a stable Budget subdomain such as `budget.doma.example.com`, add that to the Budget Vercel project before the apex cutover. The Home rewrite target should point at that stable subdomain, not at a hashed Vercel deploy URL.

## Step 9 — Verify Preview and Production

Vercel Preview checks:

1. Open the Home preview deployment.
2. Confirm the sign-in page shows no sign-up affordance.
3. Sign in with an approved non-production account.
4. Navigate to Budget.
5. Confirm Budget loads seeded staging data with no Convex `Unauthorized` errors.
6. Open `/settings/notifications`.
7. Confirm the Telegram pairing UI either creates a QR code or shows an expected environment/auth error.

Production checks:

1. Open `https://doma.example.com/` — Home renders, you see Clerk's sign-in.
2. Sign in with an allowlisted user. Home dashboard appears.
3. Click the Budget icon in the sidebar — URL becomes `https://doma.example.com/budget`.
4. Budget renders. No second sign-in (cookie shared on apex).
5. Budget's chart loads with data — Convex queries are authenticated end-to-end.
6. Open DevTools → Network. Refreshing `/budget` should show a 200 response served via Home's project; the underlying response comes from Budget's project (you'll see headers like `x-vercel-id` mentioning the Budget project, but the URL stays under the apex).
7. Open `https://doma.example.com/settings/notifications` and create a Telegram pairing QR code.
8. Open DevTools → Network. The pairing request should go to `https://doma.example.com/api/bot/linking/pairing-token` and return `201`.
9. Check Telegram webhook status with `getWebhookInfo`; the `url` must point at the deployed bot gateway.
10. Open the Telegram deep link or scan the QR code, send `/start`, and confirm the bot acknowledges the link.

## Bot Gateway Environment

`apps/api-bot` requires these environment variables in local, preview, staging, and production:

| Variable                   | Where it lives                   | Notes                                                      |
| -------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `CLERK_SECRET_KEY`         | Vercel Bot gateway, `.env.local` | Used to verify Clerk bearer tokens                         |
| `CLERK_PUBLISHABLE_KEY`    | Vercel Bot gateway, `.env.local` | Clerk backend configuration                                |
| `BOT_SERVICE_TOKEN`        | Vercel Bot gateway, callers      | Shared bearer token for service-to-service sends           |
| `TELEGRAM_BOT_TOKEN`       | Vercel Bot gateway, `.env.local` | Bot token from BotFather                                   |
| `TELEGRAM_WEBHOOK_SECRET`  | Vercel Bot gateway, Telegram     | Sent as Telegram's webhook secret token                    |
| `TELEGRAM_BOT_USERNAME`    | Vercel Bot gateway, `.env.local` | Bot username, ending in `bot`, without `@`                 |
| `UPSTASH_REDIS_REST_URL`   | Vercel Bot gateway, `.env.local` | HTTPS Upstash REST URL                                     |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel Bot gateway, `.env.local` | Upstash REST token                                         |
| `APP_ORIGIN`               | Vercel Bot gateway, `.env.local` | Public Home origin, for example `https://doma.example.com` |

`VERCEL_ENV` is read from Vercel's system environment variables and should not
be set by hand in the dashboard. Pairing links are created only when
`VERCEL_ENV=production`; preview and local bot deployments can still run health,
webhook, status, unlink, and notification routes, but `/linking/pairing-token`
returns `pairing_disabled`.

Do not commit real bot tokens, Telegram IDs, chat IDs, or private message payloads. Notification attempts store metadata only; keep it that way when adding new channels or capabilities.

For local development:

```bash
pnpm bot
pnpm --filter home dev
```

Home proxies `/api/bot/*` to `http://localhost:3002` by default. Override with `BOT_GATEWAY_DEV_ORIGIN` if the bot gateway runs elsewhere.

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
