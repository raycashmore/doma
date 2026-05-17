# Auth

We use Clerk for sign-in across all zones. One Clerk application; the cookie is set on the apex domain so every zone (Home, Budget, …) shares the session. Restricted mode — no public signups; allowlisted users only.

## One-time setup

1. Create a Clerk application at <https://dashboard.clerk.com/apps/new>.
2. **Restrict signups.** Settings → User & Authentication → disable "Enable sign-up". Add yourself + your spouse manually under Users.
3. **JWT template for Convex.** JWT Templates → New template → name it `convex`. Use the default Convex template Clerk provides.
4. Copy the publishable key, secret key, and Frontend API URL. Add to `.env.local` at the repo root:

   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
   CLERK_SECRET_KEY=sk_test_xxxxxxxx
   VITE_CLERK_FRONTEND_API_URL=https://your-app.clerk.accounts.dev
   ```

5. **Convex env var.** Convex reads `CLERK_JWT_ISSUER_DOMAIN` at runtime to validate JWTs. Set it in the Convex dashboard (Project → Settings → Environment Variables) to the same value as `VITE_CLERK_FRONTEND_API_URL`. Restart `pnpm convex` after changes.
6. **Local dev with auth.** Run `pnpm dev` — both Home and Budget pick up the env vars via `dotenv-cli`. Sign in once on either; the session covers both.
7. **Local dev without auth.** For browser automation, Playwright checks, or any local visual verification where signing in is just friction, run `pnpm --filter home dev:no-auth` or `pnpm --filter budget dev:no-auth`. These scripts unset `VITE_CLERK_PUBLISHABLE_KEY` for that process so `AuthGate` becomes a passthrough and Budget falls back to a plain `ConvexProvider`.
8. **Production.** Add the same env vars to each Vercel project. The cookie domain should be the apex (e.g. `doma.example.com`); Clerk handles this automatically when the deployment URL matches.

## How it flows

- Each app passes `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` to `<AuthGate>` from `@repo/shell`.
- When the key is set, `<AuthGate>` mounts `<ClerkProvider>` and uses `<SignedIn>` / `<SignedOut>` to gate children. Unauthed users see Clerk's sign-in.
- When the key is **not** set, `<AuthGate>` is a passthrough so the app still boots during scaffold/dev. A one-time console warning fires. This makes initial scaffold work usable without immediately requiring you to create the Clerk app.
- The repo exposes that bypass explicitly as `pnpm --filter home dev:no-auth` and `pnpm --filter budget dev:no-auth` so agents and browser tests can render the apps without going through Clerk first.
- `apps/budget/src/integrations/convex/provider.tsx` uses `ConvexProviderWithClerk` (forwarding the Clerk JWT) when the key is set, and a plain `ConvexProvider` otherwise.
- `packages/convex/convex/auth.config.ts` declares the JWT issuer so Convex can verify the token server-side. The issuer comes from `CLERK_JWT_ISSUER_DOMAIN` on the Convex side.
- Sensitive Convex queries should call `ctx.auth.getUserIdentity()` and reject when null.

## What to do after Clerk is wired

1. Verify on `localhost:3001/` (Budget) you see Clerk's sign-in screen (signed-out state).
2. Sign in with an allowlisted account; the Budget page renders.
3. Open `localhost:3000/` (Home) — clicking links from one to the other goes through the shell's `useUrlAuth` helper, which appends Clerk's `__clerk_db_jwt` so the destination port auto-rehydrates the session.
4. Reload the Convex dev process if Convex queries return 401: `pnpm convex` (it picks up the new issuer config).
