# Home

Home is Doma’s client-side Vue 3 app at the apex zone. Vite builds static files into `.output/public`; Vercel serves specific API and child-zone rewrites before the Home SPA fallback.

## Local development

```bash
pnpm --filter home dev
pnpm --filter home dev:no-auth
pnpm --filter home test
pnpm --filter home check-types
pnpm --filter home build
```

`dev:no-auth` renders the native Vue shell with generic preview content. Production mode requires both `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_CONVEX_URL` and fails closed when Convex is missing.

## Auth and live data

Home uses Clerk’s official `@clerk/vue` plugin. Presentation components read auth and data through Home-local composables.

Convex documents the community-maintained `convex-vue` adapter for Vue. Home retains that adapter for reactive queries and mutations. The local auth bridge configures its underlying official `ConvexClient` directly with `setAuth`, because `convex-vue` 0.1.5 does not manage Clerk authentication. The bridge requests Clerk's `convex` JWT template. Sign-out replaces the token fetcher with one that returns `null`, which is the browser client's documented clearing contract. Tests cover sign-in, forced token refresh, sign-out, reconnection, and disposal. If the adapter becomes unsuitable, only the Home-local composables and client setup need to change.

## PWA boundary

Home owns the root-scoped service worker. Its navigation fallback excludes `/api`, `/budget`, `/schedule`, `/lists`, and `/meals`, so another Doma zone is never treated as a Home page.
