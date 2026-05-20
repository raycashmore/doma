# Launch Runbook

This runbook covers the first live rollout of Doma and the steady-state release flow after that.

## One-time setup

1. Create a preview Convex deployment.
2. Create a production Convex deployment.
3. In Clerk Production:
   - disable public sign-up
   - add only the two approved Google accounts
   - create the `convex` JWT template
4. In each Convex cloud deployment, set `CLERK_JWT_ISSUER_DOMAIN` to the matching Clerk Frontend API URL.
5. In Vercel, configure Preview and Production environment variables for `apps/home` and `apps/budget`.
6. Confirm `apps/home/vercel.json` points to a stable Budget alias such as `https://doma-budget.vercel.app`.
7. Attach the apex domain to the Home project and add the same apex domain in Clerk Production.

## Environment variable checklist

### Budget

- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `VITE_CLERK_FRONTEND_API_URL`

### Home

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `VITE_CLERK_FRONTEND_API_URL`

### Local shell variables for seeding

- `PREVIEW_CONVEX_URL`
- `PROD_CONVEX_URL`

## Preview rehearsal

1. Refresh the local checks:

   ```bash
   pnpm format
   pnpm lint
   pnpm check-types
   pnpm test
   pnpm build
   ```

2. Seed preview data:

   ```bash
   PREVIEW_CONVEX_URL="$PREVIEW_CONVEX_URL" pnpm seed:preview
   ```

3. Push the release branch and open a PR.
4. Wait for GitHub Actions to pass.
5. Wait for Vercel Preview deployments for Home and Budget.
6. Verify Preview:
   - Home shows sign-in only
   - approved account can sign in
   - `/budget` opens without a second sign-in
   - Budget renders seeded data
   - browser console shows no Convex `Unauthorized` errors

## Production cutover

1. Seed production data:

   ```bash
   PROD_CONVEX_URL="$PROD_CONVEX_URL" pnpm seed:prod
   ```

2. Deploy Convex schema and functions:

   ```bash
   pnpm --filter @repo/convex deploy
   ```

3. Merge the approved release to `main`.
4. Wait for GitHub Actions on `main`.
5. Wait for Vercel production deploys for Home and Budget.
6. Verify Production:
   - apex domain shows sign-in only
   - approved account can sign in
   - `/budget` opens without a second sign-in
   - Budget renders seeded data
   - non-approved account cannot create access

## Rollback

### Vercel

- Home: promote the last known-good deployment in the Home Vercel project
- Budget: promote the last known-good deployment in the Budget Vercel project

### Convex

- revert the deployment in the Convex dashboard if the schema or functions need to roll back

## Ongoing release flow

1. Open PR.
2. Let GitHub Actions run format, lint, typecheck, test, and build.
3. Verify Vercel Preview.
4. Re-seed preview if the workbook source changed.
5. Seed production when preparing the cutover.
6. Deploy Convex.
7. Merge to `main`.
8. Run the production smoke test.
