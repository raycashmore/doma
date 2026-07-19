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

The noticeboard is a derived, reactive view over several owners rather than a second copy of their data. Today and Meals summaries, active forwarded-email notices, monthly spending insights, and household-authored manual notes are resolved into a deterministic Bento layout. Source cards link back to their owning Doma surface or to a Home detail route. Archives store only a household-scoped occurrence key and timestamps; source payloads remain with their owner, and a later occurrence can appear again.

Manual-note and archive mutations expose pending and recoverable error states. Dialogs trap focus and restore it to the invoking control. The page also distinguishes browser-offline, Convex-connecting, query-error, and connected states. The shell is available offline, but live data and writes always require the network.

Convex documents the community-maintained `convex-vue` adapter for Vue. Home retains that adapter for reactive queries and mutations. The local auth bridge configures its underlying official `ConvexClient` directly with `setAuth`, because `convex-vue` 0.1.5 does not manage Clerk authentication. The bridge requests Clerk's `convex` JWT template. Sign-out replaces the token fetcher with one that returns `null`, which is the browser client's documented clearing contract. Tests cover sign-in, forced token refresh, sign-out, reconnection, and disposal. If the adapter becomes unsuitable, only the Home-local composables and client setup need to change.

## PWA boundary

Home owns the root-scoped service worker. Its navigation fallback excludes `/api`, `/budget`, `/schedule`, `/lists`, and `/meals`, so another Doma zone is never treated as a Home page.

Production routing is ordered in `vercel.json`: API and child-zone rewrites come before the final Home SPA fallback. Direct loads of `/`, Home detail/settings routes, every child-zone prefix, and both API prefixes are covered by routing tests.

## Verification

Component and integration tests cover board ordering, source links, expiry and supersession, note editing, archive confirmation, focus restoration, auth token refresh/sign-out/reconnect, Telegram pairing, and routing/service-worker boundaries. Use the no-auth server for privacy-safe desktop and mobile visual checks:

```bash
pnpm --filter home dev:no-auth
```
