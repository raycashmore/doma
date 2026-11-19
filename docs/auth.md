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

### Development instance

The development Clerk instance allows Google sign-in only and restricts sign-up, so an email/password test user cannot sign in. Automated native tests sign in as the instance's Google-linked user with a Backend API sign-in token (`apps/ios/scripts/mint-test-sign-in-ticket.sh`). Native apps also need their redirect URL allowlisted in each instance; the iOS app always uses `com.doma.app://callback`, even when a device build overrides its bundle identifier for free provisioning.

## How it flows

- Home mounts Clerk through `@clerk/vue`; React zones use their framework-specific `AuthGate`, and Lists mounts Clerk through `@clerk/clerk-js`.
- When the key is set, `<AuthGate>` mounts `<ClerkProvider>` and uses `<SignedIn>` / `<SignedOut>` to gate children. Unauthed users see a sign-in-only screen for approved accounts.
- Home requires Convex whenever its Clerk key is present and otherwise enters generic local preview mode. Other zones follow their documented no-auth fixture behavior.
- The repo exposes that bypass explicitly as `pnpm --filter home dev:no-auth`, `pnpm --filter budget dev:no-auth`, `pnpm --filter schedule dev:no-auth`, and `pnpm --filter lists dev:no-auth` so agents and browser tests can render the apps without going through Clerk first.
- Home's auth bridge requests Clerk's `convex` JWT template and supplies it to the `convex-vue` client, including forced refresh and sign-out clearing. Budget uses `ConvexProviderWithClerk` when auth is enabled.
- `packages/convex/convex/auth.config.ts` declares the JWT issuer so Convex can verify the token server-side. The issuer comes from `CLERK_JWT_ISSUER_DOMAIN` on the Convex side.
- Sensitive Convex queries should call `ctx.auth.getUserIdentity()` and reject when null.

## Device login

Clerk's free plan ends every session 7 days after sign-in. The native app and its widgets must keep
working without anyone signing in again, so Clerk is used there only for the first sign-in. After
that, the device holds a **device login**: a random secret that Convex swaps for a token lasting an
hour. The web apps stay on Clerk sessions.

- `devices/login:link` (an action) needs a Clerk sign-in. A device token cannot link, so a device
  login cannot copy itself past its own revocation. It returns `{ deviceId, secret }` once and stores
  only a SHA-256 hash of the secret in `devices`.
- `devices/login:exchange` is public: the secret is the credential. It returns
  `{ status: 'issued', token, expiresAt }` or `{ status: 'rejected' }`. Rejected means the device
  login is gone and the device must sign in again; a thrown error is a setup or server fault, and
  the device keeps its secret and retries.
- Each swap checks Clerk's Backend API. A deleted or banned user deletes the device; a Clerk outage
  still issues a token, so it never signs anyone out. A rejected `CLERK_SECRET_KEY` stops the swap
  instead, so it cannot silently skip the check forever.
- A device unused for 60 days is refused and deleted when it next asks. A daily cron deletes any
  that never ask again, but only once the owner sets `DEVICE_LOGIN_CLEANUP=on` on the deployment:
  a job that deletes rows ships disabled.
- `devices/login:revoke` deletes the caller's own device, with either kind of token. The app calls it
  on sign-out. Offline, the device forgets its secret anyway; the row, now unusable, stays until the
  clean-up cron removes it.
  Deleting a row in the dashboard signs that device out within an hour.
- Tokens are ES256 JWTs with `iss` set to the deployment's `CONVEX_SITE_URL`, `aud: convex` and
  `sub` set to the Clerk user ID, so functions see the same `identity.subject` as with a Clerk
  token. `tokenIdentifier` differs between the two, so functions must not rely on it.

### Device login keys

| Variable                 | Holds                                                     |
| ------------------------ | --------------------------------------------------------- |
| `DEVICE_JWT_PRIVATE_KEY` | The P-256 signing key as a JWK with a `kid`. Secret.      |
| `DEVICE_JWT_JWKS`        | The public keys, read by `auth.config.ts` at deploy time. |
| `CLERK_SECRET_KEY`       | Clerk's secret key, for the user check. Secret.           |

Set them with `pnpm --filter @repo/convex device-login:keys`, which never prints a value:

- `setup` makes the first key pair. On the local development deployment it also copies
  `CLERK_SECRET_KEY` from the root env file. With `--prod` it prints how to pipe Clerk's live
  secret key in.
- `rotate` adds a new public key beside the current one and holds the new private key in
  `DEVICE_JWT_NEXT_PRIVATE_KEY`. Push functions so `auth.config.ts` reads the new public key, then
  run `activate`, which starts signing with it. Tokens signed with the old key pass for their
  remaining hour, so rotation signs nobody out. Rotate after any suspected leak of the private key.

Agents set keys only on the local development deployment. The owner runs the script with `--prod`.
Convex refuses to deploy while `DEVICE_JWT_JWKS` is unset, so set it before merging to `main`.
Preview deployments need it in the Convex Preview default env vars too; there `{"keys":[]}` is
enough, since nothing signs in to a preview with a device login.

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
