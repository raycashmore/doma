# Auth

We use Clerk for sign-in across all zones. One Clerk application; the cookie is set on the apex domain so every zone (Home, Budget, …) shares the session. Restricted mode only: no public signups, no public sign-up UI, and only allowlisted users.

## One-time setup

1. Create a Clerk application at <https://dashboard.clerk.com/apps/new>.
2. **Restrict signups.** Settings → Restrictions → enable Restricted mode. Add yourself + your spouse manually under Users, or enable the Allowlist and add only the approved email addresses. The app also renders `<SignIn transferable={false} withSignUp={false}>` so Google OAuth attempts for unknown emails cannot fall through into Clerk's sign-up flow.
3. **JWT template for Convex.** JWT Templates → New template → name it `convex`. Use the default Convex template Clerk provides.
4. Copy the publishable key, secret key, and Frontend API URL. Add to `.env.local` at the repo root:

   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
   CLERK_SECRET_KEY=sk_test_xxxxxxxx
   VITE_CLERK_FRONTEND_API_URL=https://your-app.clerk.accounts.dev
   ```

5. **Convex env var.** Convex reads `CLERK_JWT_ISSUER_DOMAIN` at runtime to validate JWTs. Set it in the Convex dashboard (Project → Settings → Environment Variables) to the same value as `VITE_CLERK_FRONTEND_API_URL`. Restart `pnpm convex` after changes.
6. **Local dev with auth.** Run `pnpm dev` — both Home and Budget pick up the env vars via `dotenv-cli`. Sign in once on either; the session covers both.
7. **Local dev without auth.** For browser automation, Playwright checks, or local visual verification, run `pnpm --filter home dev:no-auth` or the corresponding zone script. Home renders generic preview content; React zones use their explicit auth bypass and fixture behavior.
8. **Staging and Preview.** Use a separate non-production Clerk environment or equivalent staging-safe keys for the stable staging Convex deployment and for Vercel Preview deployments. Point staging and preview Vercel env vars plus the staging Convex issuer configuration at that environment.
9. **Production.** Add the production Clerk env vars to each Vercel project. The cookie domain should be the apex (e.g. `doma.example.com`); Clerk handles this automatically when the deployment URL matches.

## How it flows

- Home mounts Clerk through `@clerk/vue`; React zones use their framework-specific `AuthGate`, and Lists mounts Clerk through `@clerk/clerk-js`.
- When the key is set, `<AuthGate>` mounts `<ClerkProvider>` and uses `<SignedIn>` / `<SignedOut>` to gate children. Unauthed users see a sign-in-only screen for approved accounts.
- Home requires Convex whenever its Clerk key is present and otherwise enters generic local preview mode. Other zones follow their documented no-auth fixture behavior.
- The repo exposes that bypass explicitly as `pnpm --filter home dev:no-auth`, `pnpm --filter budget dev:no-auth`, `pnpm --filter schedule dev:no-auth`, and `pnpm --filter lists dev:no-auth` so agents and browser tests can render the apps without going through Clerk first.
- Home's auth bridge requests Clerk's `convex` JWT template and supplies it to the `convex-vue` client, including forced refresh and sign-out clearing. Budget uses `ConvexProviderWithClerk` when auth is enabled.
- `packages/convex/convex/auth.config.ts` declares the JWT issuer so Convex can verify the token server-side. The issuer comes from `CLERK_JWT_ISSUER_DOMAIN` on the Convex side.
- Sensitive Convex queries should call `ctx.auth.getUserIdentity()` and reject when null.

## What to do after Clerk is wired

1. Verify on `localhost:3001/` (Budget) you see Clerk's sign-in screen (signed-out state).
2. Sign in with an allowlisted account; the Budget page renders.
3. Open `localhost:3000/` (Home) — cross-zone links use Clerk's `buildUrlWithAuth`, which appends `__clerk_db_jwt` so the destination port auto-rehydrates the session.
4. Reload the Convex dev process if Convex queries return 401: `pnpm convex` (it picks up the new issuer config).

## Production checklist

1. Switch Clerk to the Production environment.
2. Disable public sign-up.
3. Add only the two approved Google accounts under Users.
4. Confirm the app sign-in screen shows no sign-up link or sign-up button.
5. Confirm `CLERK_JWT_ISSUER_DOMAIN` in the production Convex deployment matches the production Clerk frontend API URL.
