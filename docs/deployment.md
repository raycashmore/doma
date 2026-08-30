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
| Vercel project for Agent API       | Vercel          | Runs inspectable AI SDK agents     |
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

Create one deployment for staging and one for production. Each command prints a deployment URL (something like `https://<name>.convex.cloud`). Save both — Vite apps use it as `VITE_CONVEX_URL`, and Next.js apps use it as `NEXT_PUBLIC_CONVEX_URL`.

In the Convex dashboard for each cloud deployment:

- **Settings → Environment Variables**: set `CLERK_JWT_ISSUER_DOMAIN` to the Clerk Frontend API URL for that environment.

### Android widget Firebase delivery

The Android companion receives only opaque widget-refresh FCM data messages.
For each Convex deployment used by the companion, set
`FIREBASE_SERVICE_ACCOUNT_JSON` in the Convex dashboard to the complete Firebase
service-account JSON for the matching Firebase project. This is a secret: never
place it in `apps/android/local.properties`, source control, Vercel variables,
or a mobile build.

The sideloaded Android build instead needs these public client identifiers in
its ignored `apps/android/local.properties`: Firebase application ID, project
ID, Web API key, and sender ID, plus the Convex URL and matching Clerk
publishable key. Register the Android package and debug/release signing
fingerprints in both Google Cloud OAuth and Clerk Native Applications before
testing Google sign-in. See `apps/android/config.example.properties` for exact
property names.

- **Preview deployments → Default environment variables**: set the same backend env vars needed by Vercel Preview deployments. At minimum this includes `CLERK_JWT_ISSUER_DOMAIN`; Schedule previews also need the Google Calendar service account variables listed below. Vercel env vars do not automatically become Convex deployment env vars.

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

Use Convex Preview deployments for Vercel Preview so each preview can deploy the current Convex functions and get a generated backend URL during the frontend build.

For Vercel Preview on Budget, set:

| Name                          | Value                          |
| ----------------------------- | ------------------------------ |
| `CONVEX_DEPLOY_KEY`           | Convex preview deploy key      |
| `VITE_CLERK_PUBLISHABLE_KEY`  | Clerk preview publishable key  |
| `CLERK_SECRET_KEY`            | Clerk preview secret key       |
| `VITE_CLERK_FRONTEND_API_URL` | Clerk preview Frontend API URL |

For Vercel Preview on Home, set:

| Name                          | Value                          |
| ----------------------------- | ------------------------------ |
| `CONVEX_DEPLOY_KEY`           | Convex preview deploy key      |
| `VITE_CLERK_PUBLISHABLE_KEY`  | Clerk preview publishable key  |
| `CLERK_SECRET_KEY`            | Clerk preview secret key       |
| `VITE_CLERK_FRONTEND_API_URL` | Clerk preview Frontend API URL |

Configure Home's Preview build command to deploy the current Convex functions and inject the generated URL:

```bash
pnpm --dir ../.. --filter @repo/convex exec convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'pnpm --dir ../.. --filter home build'
```

For Vercel Preview on Schedule, set:

| Name                                | Value                         |
| ----------------------------------- | ----------------------------- |
| `CONVEX_DEPLOY_KEY`                 | Convex preview deploy key     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk preview publishable key |
| `CLERK_SECRET_KEY`                  | Clerk preview secret key      |
| `BOT_SERVICE_TOKEN`                 | Shared bot service token      |

Do not set a static `NEXT_PUBLIC_CONVEX_URL` for Schedule Preview. Next inlines
`NEXT_PUBLIC_` variables at build time, so let `convex deploy --cmd` create the
Convex Preview deployment and inject the generated URL into the Schedule build:

```bash
pnpm --dir ../.. --filter @repo/convex exec convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd 'pnpm --dir ../.. --filter schedule build'
```

Set that as the Schedule Vercel project's Preview build command. If Vercel logs
`no Convex deployment configuration found`, the Schedule project cannot see
`CONVEX_DEPLOY_KEY`; check the variable's project, environment scope, branch
scope, and redeploy after changes.

For Vercel Preview on the Bot gateway, set the same Clerk server credentials plus the bot gateway variables from [Bot Gateway Environment](#bot-gateway-environment). Use preview Telegram bots and preview Upstash databases where possible.

For Vercel Preview on the Agent API, set the variables from
[Agent API Environment](#agent-api-environment). Use the same preview Convex
deployment as Meals and set the matching service token in both Vercel and
Convex.

If the Vercel Preview environment uses a temporary Convex deployment, seed that
deployment by passing its current Convex URL:

```bash
pnpm seed:url -- https://<preview>.convex.cloud
```

The command runs locally and reads a local excel spreadsheet. It
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

## Step 5a — Deploy Agent API

Create a separate Vercel project rooted at `apps/api-agent`, using the Other
framework preset, `pnpm build`, and no output directory. Set the variables in
[Agent API Environment](#agent-api-environment), deploy it, and attach the
stable domain used by Home's `/api/agent/*` rewrite. Its `vercel.json` routes
`/weekly-meals` and `/health` to the Hono handler.

Deploy Convex schema and function changes before deploying a new Agent API
version that sends additional trace fields. The older Convex mutation validator
will reject fields it does not yet recognize.

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

Home owns the apex. Before deploying, confirm its API and child-zone rewrites point at the stable Bot, Agent, Budget, Schedule, Lists, and Meals destinations. All specific rewrites must remain before the final `/(.*)` Home SPA fallback.

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

4. **Environment Variables** on the Home project:

   | Name                          | Value                            |
   | ----------------------------- | -------------------------------- |
   | `VITE_CLERK_PUBLISHABLE_KEY`  | Clerk production publishable key |
   | `VITE_CONVEX_URL`             | Convex production deployment URL |
   | `CLERK_SECRET_KEY`            | Clerk production secret key      |
   | `VITE_CLERK_FRONTEND_API_URL` | Clerk Frontend API URL           |

5. After deployment, verify direct loads for `/`, `/settings/notifications`, a Home notice-detail URL, `/budget`, `/schedule`, `/lists`, and `/meals`. Confirm `/api/bot/*` and `/api/agent/*` reach their services rather than `index.html`. In an installed/previously visited Home PWA, confirm the Home shell opens offline while child-zone and API requests are not intercepted.

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
2. Sign in with an allowlisted user. Home noticeboard appears with Today and Meals summaries; source cards navigate to their owning surface.
3. Click the Budget icon in the sidebar — URL becomes `https://doma.example.com/budget`.
4. Budget renders. No second sign-in (cookie shared on apex).
5. Budget's chart loads with data — Convex queries are authenticated end-to-end.
6. Add and edit a generic manual note, archive one occurrence after confirmation, and confirm a second signed-in client updates without refresh. Verify pending/error affordances and that keyboard focus returns to the invoking control.
7. Open notification settings. Verify Telegram status refresh, pairing, and unlinking in production; non-production deployments must explain that pairing is unavailable.
8. Sign out and confirm Home data is protected. Sign back in and leave the tab open through a token refresh/reconnect cycle.
9. Open DevTools → Network. Refreshing `/budget` should show a 200 response served via Home's project; the underlying response comes from Budget's project (you'll see headers like `x-vercel-id` mentioning the Budget project, but the URL stays under the apex).
10. Open `https://doma.example.com/settings/notifications` and create a Telegram pairing QR code.
11. Open DevTools → Network. The pairing request should go to `https://doma.example.com/api/bot/linking/pairing-token` and return `201`.
12. Check Telegram webhook status with `getWebhookInfo`; the `url` must point at the deployed bot gateway.
13. Open the Telegram deep link or scan the QR code, send `/start`, and confirm the bot acknowledges the link.

## Bot Gateway Environment

`apps/api-bot` requires these environment variables in local, preview, staging, and production:

| Variable                                    | Where it lives                                | Notes                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLERK_SECRET_KEY`                          | Vercel Bot gateway, `.env.local`              | Used to verify Clerk bearer tokens                                                                                                          |
| `CLERK_PUBLISHABLE_KEY`                     | Vercel Bot gateway, `.env.local`              | Clerk backend configuration                                                                                                                 |
| `BOT_SERVICE_TOKEN`                         | Vercel Bot gateway, Schedule, Convex, callers | Shared bearer token for service-to-service sends, schedule bot reads, and forwarded email capture                                           |
| `CONVEX_URL`                                | Vercel Bot gateway, `.env.local`              | Required for forwarded email capture and the insights capability; Convex deployment URL for gateway service clients                         |
| `FORWARDED_EMAIL_ALLOWED_SENDERS`           | Vercel Bot gateway, `.env.local`              | Comma-separated sender allowlist for Resend forwarded email capture                                                                         |
| `RESEND_API_KEY`                            | Vercel Bot gateway, `.env.local`              | Resend API key used to fetch received email bodies after `email.received` webhooks                                                          |
| `RESEND_WEBHOOK_SECRET`                     | Vercel Bot gateway, Resend                    | Resend webhook signing secret used to verify `/inbound-email/resend` requests                                                               |
| `AGENT_SERVICE_ORIGIN`                      | Convex, `.env.local`                          | Public origin of the matching Vercel Agent API used for forwarded-email triage                                                              |
| `FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS` | Convex, `.env.local`                          | Comma-separated Clerk user IDs that should receive due forwarded-email reminders                                                            |
| `SPENDING_INSIGHT_RECIPIENT_USER_IDS`       | Convex, `.env.local`                          | Comma-separated Clerk user IDs that should receive monthly spending insight messages                                                        |
| `SCHEDULE_CAPABILITY_URL`                   | Vercel Bot gateway, `.env.local`              | Schedule API route for `/schedule`, for example `https://schedule.example.com/schedule/api/bot/schedule`                                    |
| `LISTS_CAPABILITY_URL`                      | Vercel Bot gateway, `.env.local`              | Lists API route for free-text capture, for example `https://lists.example.com/lists/api/bot/lists`                                          |
| `LISTS_CAPABILITY_TIMEOUT_MS`               | Vercel Bot gateway, `.env.local`              | Optional; per-request timeout for the lists capability (default 15000)                                                                      |
| `INSIGHTS_CAPABILITY_TIMEOUT_MS`            | Vercel Bot gateway, `.env.local`              | Optional; per-question timeout for the insights capability (default 15000)                                                                  |
| `SPENDING_INSIGHT_AI_MODEL`                 | Convex, `.env.local`                          | OpenAI model used by Convex to generate monthly spending insights and answer bot questions about them                                       |
| `OPENAI_API_KEY`                            | Vercel Bot gateway, Convex, `.env.local`      | Enables the LLM intent router on the gateway; also used by Convex for AI item parsing, briefing generation, and spending insight generation |
| `INTENT_ROUTER_AI_MODEL`                    | Vercel Bot gateway, `.env.local`              | Model the intent router uses; required with `OPENAI_API_KEY` to enable free-text routing                                                    |
| `INTENT_ROUTER_AI_TIMEOUT_MS`               | Vercel Bot gateway, `.env.local`              | Optional; per-request timeout for the intent router AI call (default 10000)                                                                 |
| `TELEGRAM_BOT_TOKEN`                        | Vercel Bot gateway, `.env.local`              | Bot token from BotFather                                                                                                                    |
| `TELEGRAM_WEBHOOK_SECRET`                   | Vercel Bot gateway, Telegram                  | Sent as Telegram's webhook secret token                                                                                                     |
| `TELEGRAM_BOT_USERNAME`                     | Vercel Bot gateway, `.env.local`              | Bot username, ending in `bot`, without `@`                                                                                                  |
| `UPSTASH_REDIS_REST_URL`                    | Vercel Bot gateway, `.env.local`              | HTTPS Upstash REST URL                                                                                                                      |
| `UPSTASH_REDIS_REST_TOKEN`                  | Vercel Bot gateway, `.env.local`              | Upstash REST token                                                                                                                          |
| `APP_ORIGIN`                                | Vercel Bot gateway, `.env.local`              | Public Home origin, for example `https://doma.example.com`                                                                                  |

`VERCEL_ENV` is read from Vercel's system environment variables and should not
be set by hand in the dashboard. Pairing links are created only when
`VERCEL_ENV=production`; preview and local bot deployments can still run health,
webhook, status, unlink, and notification routes, but `/linking/pairing-token`
returns `pairing_disabled`.

Do not commit real bot tokens, Telegram IDs, chat IDs, or private message payloads. Notification attempts store metadata only; keep it that way when adding new channels or capabilities.

## Agent API Environment

`apps/api-agent` requires:

| Variable                          | Where it lives                         | Notes                                                                                                                                 |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `CLERK_SECRET_KEY`                | Vercel Agent API, `.env.local`         | Verifies Meals bearer tokens                                                                                                          |
| `CLERK_PUBLISHABLE_KEY`           | Vercel Agent API, `.env.local`         | Clerk backend configuration                                                                                                           |
| `APP_ORIGIN`                      | Vercel Agent API, `.env.local`         | Authorized public Home origin                                                                                                         |
| `CONVEX_URL`                      | Vercel Agent API, `.env.local`         | Matching Convex deployment                                                                                                            |
| `AGENT_SERVICE_TOKEN`             | Vercel Agent API, Convex, `.env.local` | Dedicated service credential; do not reuse the bot token                                                                              |
| `WEEKLY_MEALS_AI_MODEL`           | Vercel Agent API, `.env.local`         | AI Gateway model id for weekly meal proposals                                                                                         |
| `FORWARDED_EMAIL_TRIAGE_AI_MODEL` | Vercel Agent API, `.env.local`         | AI Gateway model id for forwarded-email triage                                                                                        |
| `AI_GATEWAY_API_KEY`              | Local Agent API                        | AI Gateway credential for local runs; Vercel deployments use their injected OIDC identity                                             |
| `LANGFUSE_PUBLIC_KEY`             | Vercel Agent API                       | Optional Langfuse project public key; tracing is disabled unless this and `LANGFUSE_SECRET_KEY` are both configured                   |
| `LANGFUSE_SECRET_KEY`             | Vercel Agent API                       | Optional Langfuse project secret key; do not commit it                                                                                |
| `LANGFUSE_BASE_URL`               | Vercel Agent API                       | Optional Langfuse regional or self-hosted origin; defaults to `https://cloud.langfuse.com`                                            |
| `LANGFUSE_ENVIRONMENT`            | Vercel Agent API                       | Optional environment label on Langfuse traces, for example `production` or `preview`                                                  |
| `LANGFUSE_TRACE_CONTENT`          | Vercel Agent API                       | Set to exactly `true` only after approving external retention of raw forwarded-email input and model output; metadata-only by default |

The service persists privacy-safe agent traces and token usage for 30 days. It
does not persist hidden reasoning, raw calendar events, or forwarded-email
sender, subject, or body in trace rows. Model failures emit structured events
in the Agent API's Vercel Runtime Logs. Logs exclude user IDs, prompts,
household instructions, email content, tool context, and credentials; any
retained provider diagnostic is normalized, redacted against email input and
attachment metadata, and limited to 500 characters.

Forwarded email capture uses Resend's `email.received` webhook at
`/inbound-email/resend`. Configure that webhook on a publicly reachable Bot
gateway production URL, not a Vercel preview URL protected by SSO/deployment
protection. The Bot gateway verifies `RESEND_WEBHOOK_SECRET`, checks
`FORWARDED_EMAIL_ALLOWED_SENDERS`, fetches the full received email body with
`RESEND_API_KEY`, then writes to Convex. Set the same `BOT_SERVICE_TOKEN` in the
Bot gateway and the target Convex deployment before enabling forwarded email
capture.

Forwarded email triage runs in Convex cron every 15 minutes after capture, and can
also be triggered manually through
`email/triage:processNextPendingCapturedEmailForBot`. It requires
`AGENT_SERVICE_ORIGIN` and `AGENT_SERVICE_TOKEN` in Convex, plus
`FORWARDED_EMAIL_TRIAGE_AI_MODEL` in the Agent API. The triage action claims the
oldest pending captured email, delegates typed inference to the Agent API, then
stores either a current notice or a no-notice outcome. Only a high-priority,
high-confidence future obligation creates a reminder candidate.

Failed captures can be requeued without forwarding the source email again via
`email/triage:retryFailedCapturedEmailForBot`; it requires the configured
`BOT_SERVICE_TOKEN` and requeues only rows in the `failed` state.

When Langfuse credentials are configured on the Agent API, each forwarded-email
triage run emits a root observation and nested generation observation through
Langfuse's OTLP endpoint. The export is best-effort and has a 1.5-second timeout,
so Langfuse outages cannot interrupt notice creation. It records timing, model,
prompt version, token usage, input shape, output classification, and validation state.
Raw forwarded-email input and generated notice content are never exported.

### One-time email-notice expiry backfill

After deploying the lifecycle change to the target Convex deployment, run the
appropriate internal mutation command repeatedly until it returns
`{"patched":0,"hasMore":false}`. Confirm the target deployment before using
`--prod`; do not include email content in command arguments.

```bash
pnpm --filter @repo/convex exec convex run email/noticeExpiryBackfill:backfillMissingExpiries '{}'
pnpm --filter @repo/convex exec convex run email/noticeExpiryBackfill:backfillMissingExpiries '{}' --prod
```

The mutation patches only legacy notices missing `expiresAt`, so repeated runs
are safe. Convex supports running internal mutations from the CLI; see
[internal functions](https://docs.convex.dev/functions/internal-functions) and
[the `convex run` reference](https://docs.convex.dev/cli/reference/run).

Monthly spending insight generation runs in Convex cron every 12 hours (also an
interval, not a wall-clock time). Each sweep finds the latest calendar month
that has both `spendCategoryBreakdown` data and a `budget` row but no stored
`spendingInsights` row, assembles the trailing ~12 months of spend categories
and budget-level totals, and asks the model for a headline, observations, and a
next-month prediction. It requires `OPENAI_API_KEY` and
`SPENDING_INSIGHT_AI_MODEL` in the target Convex deployment; when either is
unset the sweep skips cleanly. Failures and malformed AI output store nothing,
so the next sweep retries the same month. Deleting a `spendingInsights` row
causes a later sweep to regenerate it — each sweep fills the latest missing
eligible month first, one month per sweep.

Privacy: enabling this cron sends budget-level totals (income, one-offs, card
spend), spend category labels, and category amounts for the trailing ~12
months to the configured OpenAI-compatible provider. Account balances,
mortgage, and investment data are never included.

Monthly spending insight delivery runs in Convex cron every hour (an interval,
not a wall-clock time) through `insights/deliveryRunner:runDueSpendingInsightDelivery`.
It requires `BOT_SERVICE_TOKEN` and `BOT_GATEWAY_ORIGIN` in the target Convex
deployment; when either is unset the run skips cleanly without error. Each run
considers only the latest stored `spendingInsights` month — older or backfilled
months are never delivered late — and sends its headline, observation bullets,
and next-month prediction as plain text through the Bot gateway's
`/notifications/send` endpoint with topic `insights.spending`. Recipients come
from `SPENDING_INSIGHT_RECIPIENT_USER_IDS`, an insight-specific list separate
from the briefing and email notice lists, so spending insight delivery can be
enabled or limited independently. Delivery attempts are recorded per month and recipient in
`spendingInsightDeliveryAttempts`; failed sends are retried by later runs, and
sent or skipped deliveries are never repeated.

Forwarded email reminder delivery runs in Convex through
`email/deliveryRunner:deliverDueEmailRemindersForBot`. It requires
`BOT_SERVICE_TOKEN`, `BOT_GATEWAY_ORIGIN`, and
`FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS` in the target Convex deployment.
Convex checks every 15 minutes and sends at or after 7pm Australia/Sydney on the
day before the extracted due date, handling daylight saving from the local
calendar date. Delivery rechecks that the canonical notice is still active and
that Home has not archived its occurrence, then uses the Bot gateway's
provider-neutral `/notifications/send` endpoint with topic `email.reminder`.
Attempts are recorded per reminder candidate and recipient. It uses
the notice-specific recipient list, not `MORNING_BRIEFING_RECIPIENT_USER_IDS`,
so forwarded email experiments can be limited independently from scheduled
briefings.

Schedule's bot capability route (`/schedule/api/bot/schedule` in production),
the Convex `schedule.queries.currentWeekForBot` query, and the
`briefing.generation.*ForBot` functions validate `BOT_SERVICE_TOKEN`. Set the
same value in the Bot gateway, Schedule app, and the target Convex deployment
before enabling `SCHEDULE_CAPABILITY_URL`.

The Schedule capability supports these Telegram commands:

| Command                        | Behavior                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `/briefing`                    | Replays today's stored full-day briefing, or generates and stores one on demand                  |
| `/schedule briefing`           | Alias for `/briefing`                                                                            |
| `/briefing morning`            | Previews the scheduled morning delivery message without recording a scheduled delivery attempt   |
| `/schedule briefing morning`   | Alias for `/briefing morning`                                                                    |
| `/briefing afternoon`          | Previews the scheduled afternoon delivery message without recording a scheduled delivery attempt |
| `/schedule briefing afternoon` | Alias for `/briefing afternoon`                                                                  |
| `/schedule upcoming`           | Pull-based list of upcoming schedule events                                                      |

Doma no longer sends proactive event-level schedule reminders.

The Bot gateway classifies free-text (non-slash) Telegram messages with an LLM
intent router and dispatches each message to a single capability — for example
the Lists capability, which captures **list items** into the sender's **default
list**. The router runs on the gateway and needs `OPENAI_API_KEY` and
`INTENT_ROUTER_AI_MODEL` set there; without them the gateway has no classifier
and every free-text message returns a capabilities hint instead of routing. See
`docs/adr/0002-llm-intent-router.md` for the routing design.

The lists capability route (`/lists/api/bot/lists` in production) and the Convex
`lists.bot.*` functions both validate `BOT_SERVICE_TOKEN`. Set the same value in
the Bot gateway, Lists app, and the target Convex deployment, and set
`LISTS_CAPABILITY_URL` to the lists route, before enabling free-text capture.
The Lists route reads `CONVEX_URL` (falling back to `VITE_CONVEX_URL`) to reach
Convex. AI item parsing is optional: with `OPENAI_API_KEY` and
`LIST_ITEMS_AI_MODEL` set on Convex it uses the model, otherwise it falls back
to a deterministic newline split.

The insights capability answers free-text questions about the stored monthly
spending insights ("what did the insights say about groceries?"). Unlike the
schedule and lists capabilities it has no HTTP route: it runs in-process on the
Bot gateway and calls the Convex `insights.qa.answerSpendingInsightQuestionForBot`
action, which validates `BOT_SERVICE_TOKEN`. It is registered when `CONVEX_URL`
is set on the gateway. Answers are generated fresh per question, grounded in the
stored latest insight plus the trailing months of data that produced it, using
`OPENAI_API_KEY` and `SPENDING_INSIGHT_AI_MODEL` on Convex; when either is unset
the capability replies with a generic failure message, and when no insight is
stored yet it says so instead of inventing commentary.

Morning briefing delivery runs from Convex scheduled functions, not Vercel Cron. This keeps
the Bot gateway deployable on Vercel Hobby, where frequent cron schedules are
rejected. A 24-hour Convex reconciler schedules the next 48 hours of eligible local retry slots;
the delivery action runs only during the
local morning retry window `08:20 <= time < 08:50` every day and afternoon retry
window `14:30 <= time < 15:00` on weekdays only, forces a schedule sync before generation when possible,
falls back to cached schedule data when needed, calls the Bot gateway's
provider-neutral `/notifications/send` endpoint, and records the briefing
delivery attempt in Convex per recipient and delivery slot.

Set these Convex env vars on every Convex deployment that should send morning
briefings:

| Variable                              | Where it lives             | Notes                                                                                                                                                 |
| ------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BOT_GATEWAY_ORIGIN`                  | Convex                     | Public Bot gateway origin, for example `https://bot.example.com`; no path or trailing slash                                                           |
| `BOT_SERVICE_TOKEN`                   | Convex, Vercel Bot gateway | Bearer token Convex sends to `/notifications/send` and Schedule validates for bot capability                                                          |
| `MORNING_BRIEFING_RECIPIENT_USER_IDS` | Convex                     | Comma-separated Clerk user IDs that should receive scheduled morning briefings                                                                        |
| `MORNING_BRIEFING_TZ`                 | Convex                     | Optional; falls back to `SCHEDULE_TZ`, then `Australia/Sydney`                                                                                        |
| `MORNING_BRIEFING_AI_MODEL`           | Convex                     | Required with `OPENAI_API_KEY` for AI generation; otherwise generation uses deterministic text                                                        |
| `MORNING_BRIEFING_LATITUDE`           | Convex                     | Optional latitude for weather context in AI-generated morning briefings; configure with `MORNING_BRIEFING_LONGITUDE`                                  |
| `MORNING_BRIEFING_LONGITUDE`          | Convex                     | Optional longitude for weather context in AI-generated morning briefings; configure with `MORNING_BRIEFING_LATITUDE`                                  |
| `LANGFUSE_PUBLIC_KEY`                 | Convex                     | Optional Langfuse project public key; tracing is disabled unless this and `LANGFUSE_SECRET_KEY` are both configured                                   |
| `LANGFUSE_SECRET_KEY`                 | Convex                     | Optional Langfuse project secret key; do not commit it                                                                                                |
| `LANGFUSE_BASE_URL`                   | Convex                     | Optional Langfuse regional or self-hosted origin; defaults to `https://cloud.langfuse.com`                                                            |
| `LANGFUSE_ENVIRONMENT`                | Convex                     | Optional environment label on Langfuse traces, for example `production` or `preview`                                                                  |
| `LANGFUSE_TRACE_CONTENT`              | Convex                     | Set to exactly `true` only after approving external retention of private calendar inputs and rendered briefing content; metadata-only by default      |
| `LIST_ITEMS_AI_MODEL`                 | Convex                     | Optional; with `OPENAI_API_KEY`, the model used to parse free-text Telegram captures into list items; otherwise a deterministic newline split is used |
| `LIST_CATEGORISATION_AI_MODEL`        | Convex                     | Optional; with `OPENAI_API_KEY`, the model used to assign list items to the configured select-property options; otherwise items remain Unassigned     |
| `OPENAI_API_KEY`                      | Convex                     | Required with `MORNING_BRIEFING_AI_MODEL`, `LIST_ITEMS_AI_MODEL`, or `LIST_CATEGORISATION_AI_MODEL` for AI generation                                 |

Morning briefing operations:

- A scheduled delivery outside `08:20 <= time < 08:50` in
  `MORNING_BRIEFING_TZ`, or outside the weekday-only `14:30 <= time < 15:00`
  afternoon window, no-ops. Morning delivery sends the headline plus relevant
  morning, afternoon, and watchout details, and skips the notification when the
  day has no briefing content, including on weekends. Afternoon delivery sends
  only unusual watchouts backed entirely by ordinary schedule events; it skips
  when none qualify, and daily-requirements items cannot trigger it.
- If no `MORNING_BRIEFING_RECIPIENT_USER_IDS` are configured, the scheduled run
  no-ops. `/briefing` can still be used on demand by a linked Telegram user.
- Convex generates one briefing per local date and reuses it for morning
  retries and replay. After a successful 2:30pm schedule sync, the afternoon
  scheduled send refreshes that stored briefing before rendering the afternoon
  message. Morning and afternoon scheduled sends use separate delivery keys, so
  a recipient with a sent or skipped morning attempt can still receive the
  afternoon attempt for the same briefing.
- If AI suppresses a quiet briefing or produces an empty message, scheduled
  delivery records the recipient as skipped instead of sending an empty
  notification.
- If optional weather coordinates are configured, AI-generated briefings can use
  Open-Meteo forecast context to make an already-qualified briefing more
  practical. Weather does not cause quiet-day notifications by itself. Missing,
  invalid, or unavailable weather context falls back to schedule-only AI
  generation.
- When Langfuse credentials are configured, every AI-generated morning briefing
  emits a root observation and nested generation observation through Langfuse's
  OTLP endpoint. The export is best-effort and can never force a fallback; it
  has a 1.5-second timeout so an unavailable Langfuse endpoint cannot hold the
  briefing indefinitely. It records timing, model, source counts, output shape,
  and generation status by default. Set `LANGFUSE_TRACE_CONTENT=true` only when
  the Langfuse project is an approved destination for private schedule input and
  briefing text; this enables the full input/output needed for manual review and
  output-quality evaluation.
- Stored briefings are plain text. AI output that leaks internal member ids,
  uses unknown member ownership, includes markup delimiters, or includes escaped
  HTML entities is rejected and replaced with the deterministic schedule
  summary. Stored rows that no longer satisfy the plain-text contract are
  ignored for replay and replaced on the next generation attempt; stored
  structured lines must also reference known member ids.
- Scheduled briefing notifications and delivery previews stay plain text. The
  Telegram provider applies bold display entities for the keywords `swimming`,
  `dancing`, `library`, `homework`, and `sport` when sending the final message.
- If schedule sync fails but cached schedule data exists, Doma can still send
  the briefing. When the cache is older than 12 hours, it appends:
  `Note: schedule data may be stale because the latest calendar sync failed.`
- If AI generation fails or returns invalid output, Doma stores and sends a
  deterministic fallback rather than retrying generation for the same local
  date.
- If no daily requirements calendar is configured, the briefing is a setup
  problem, not a quiet day. Configure at least one calendar with
  `"kind":"dailyRequirements"` in `SCHEDULE_CALENDARS`.

Historical `scheduleReminderAttempts` rows are retained for audit context. Do
not delete them as part of deploying morning briefing delivery.

For local development:

```bash
pnpm bot
pnpm agent
pnpm --filter home dev
pnpm --filter meals dev
```

Home proxies `/api/bot/*` to `http://localhost:3002` by default. Override with `BOT_GATEWAY_DEV_ORIGIN` if the bot gateway runs elsewhere.
Meals proxies `/api/agent/*` to `http://localhost:3006` by default. Override with `AGENT_SERVICE_DEV_ORIGIN` when needed.

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
5. If the new app uses Convex, set the right public Convex URL env var for stable environments (`VITE_CONVEX_URL` for Vite, `NEXT_PUBLIC_CONVEX_URL` for Next.js). For Vercel Preview, set `CONVEX_DEPLOY_KEY` and run the app build through `convex deploy --cmd` so the generated preview URL is injected during the build. If the app does not use Convex, set only the Clerk vars.
6. Add or enable the app in `packages/app-registry/src/index.ts` and attach a React icon in `packages/shell/src/apps.ts`. Ship the registry/shell update so the app appears in shared navigation.

## Environment-variable reference

| Variable                                                                 | Where it lives                                         | Used by                        | Notes                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------- |
| `VITE_CONVEX_URL`                                                        | Vercel Vite apps, `.env.local`                         | Browser-side Convex client     | Static for stable deployments; injected by `convex deploy --cmd` for previews   |
| `NEXT_PUBLIC_CONVEX_URL`                                                 | Vercel Next.js apps, `.env.local`                      | Browser-side Convex client     | Static for stable deployments; injected by `convex deploy --cmd` for previews   |
| `CONVEX_DEPLOY_KEY`                                                      | Vercel Preview env                                     | Convex CLI during Vercel build | Preview deploy key; must exist on each Vercel project that runs `convex deploy` |
| `VITE_CLERK_PUBLISHABLE_KEY`                                             | Vercel (every app), `.env.local`                       | Browser-side Clerk SDK         | `pk_test_…` in dev, `pk_live_…` in prod                                         |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                                      | Vercel Next.js apps, `.env.local`                      | Browser-side Clerk SDK         | Next.js public name for Schedule                                                |
| `CLERK_SECRET_KEY`                                                       | Vercel (every app), `.env.local`                       | Server-side Clerk operations   | Never expose to the browser                                                     |
| `VITE_CLERK_FRONTEND_API_URL`                                            | Vercel (every app), `.env.local`                       | Clerk JWT issuer URL           | Same in every app; one per Clerk env                                            |
| `CLERK_JWT_ISSUER_DOMAIN`                                                | Convex dashboard (deployment env and preview defaults) | Convex auth.config.ts          | Same value as the Clerk Frontend API URL                                        |
| `FIREBASE_SERVICE_ACCOUNT_JSON`                                          | Convex dashboard (deployment env and preview defaults) | Android widget FCM delivery    | Secret; never place in source control, Vercel, or a mobile build                |
| `GOOGLE_SA_KEY`, `SCHEDULE_CALENDARS`, `SCHEDULE_MEMBERS`, `SCHEDULE_TZ` | Convex dashboard (deployment env and preview defaults) | Schedule sync actions          | Private calendar ingestion config; never put in git                             |

## Common pitfalls

- **Forgetting to update `apps/home/vercel.json` rewrites** after deploying Budget. The rewrite points at a placeholder URL by default; until you change it, `/budget` returns Vercel's "no such project" error.
- **Pointing rewrites at the hashed deployment URL** (`doma-budget-<git-sha>.vercel.app`). That URL changes per deploy. Use the project's stable alias (`doma-budget.vercel.app`) or a custom subdomain instead.
- **Convex env var `CLERK_JWT_ISSUER_DOMAIN` not set** in the target Convex deployment. Symptoms: `convex deploy` fails with "used in auth config file but its value was not set", or browser queries return 401. Fix the deployment env var and the Convex Preview default env vars in the Convex dashboard.
- **Setting backend env vars only in Vercel**. Vercel env vars are available to the frontend build; Convex functions read Convex deployment env vars. Schedule previews need `CLERK_JWT_ISSUER_DOMAIN` and the Google Calendar service account variables in Convex Preview defaults.
- **Clerk cookie scoped to the wrong domain**. The production Clerk env needs your apex added under **Domains**. Without it, the cookie is set on Clerk's own subdomain and zones can't see it.
- **Different Convex deployments for dev vs prod sharing schema state**. They don't. Schema migrations apply per deployment — when you deploy Convex to production, push the same schema you're running in dev.
- **Build failing on Vercel with "module not found"** for a `@repo/*` workspace package. Check Vercel's "Install Command" — it should run `pnpm install` from the repo root (default). If you set it to install from `apps/<name>` only, workspace symlinks won't resolve.
- **PWA service worker caching old assets across deploys**. `vite-plugin-pwa` is configured with `registerType: 'autoUpdate'` so this shouldn't bite, but if you see stale UI after a deploy, do a hard refresh once to force the new SW to take over.

## Rollback

Each Vercel project has its own deploy history. Roll back via the dashboard (Deployments → … → "Promote to Production" on the prior good one) per app. Rolling back Home alone is safe (rewrites still point at Budget's then-current deploy); rolling back Budget alone is also safe (Home's rewrite finds whatever Budget has live).

If a schema change in Convex needs reverting, do that from the Convex dashboard — Convex versions deploys.
