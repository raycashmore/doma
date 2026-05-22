# Launch Runbook

This runbook covers the first live rollout of Doma and the steady-state release flow after that.

## One-time setup

1. Create a staging Convex deployment.
2. Create a production Convex deployment.
3. In Clerk Production:
   - disable public sign-up
   - add only the two approved Google accounts
   - create the `convex` JWT template
4. In each Convex cloud deployment, set `CLERK_JWT_ISSUER_DOMAIN` to the matching Clerk Frontend API URL.
5. In Vercel, configure Preview and Production environment variables for `apps/home` and `apps/budget`.
6. Add a stable Budget subdomain such as `budget.doma.example.com` to the Budget Vercel project.
7. Confirm `apps/home/vercel.json` points to that stable Budget alias.
8. Attach the apex domain to the Home project and add the same apex domain in Clerk Production.

## DNS layout

Recommended production layout:

- `doma.example.com` → Home apex
- `budget.doma.example.com` → stable Budget alias for Home rewrites
- `www.doma.example.com` → optional redirect or alias to Home

Typical DNS record patterns:

- apex host (`@` or `doma`) → use the exact `A`, `ALIAS`, or `ANAME` target Vercel provides
- `budget` → `CNAME` to the Budget Vercel target
- `www` → optional `CNAME` to the Home Vercel target

Recommended order:

1. Verify the Budget subdomain in Vercel.
2. Update Home rewrites to point at the Budget subdomain.
3. Verify the apex domain in the Home Vercel project.
4. Add the apex domain in Clerk Production.

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

- `STAGING_CONVEX_URL`
- `PROD_CONVEX_URL`

For Vercel Preview deployments that create temporary Convex deployments, pass
the current Convex URL directly:

```bash
pnpm seed:url -- https://<preview>.convex.cloud
```

The seed command runs locally, read a local excel spreadsheet, clears
the seedable tables on the target deployment, and inserts the workbook data.
Confirm the target URL before running it.

## Preview rehearsal

1. Refresh the local checks:

   ```bash
   pnpm format
   pnpm lint
   pnpm check-types
   pnpm test
   pnpm build
   ```

2. Seed staging data for the backend that Preview will use.

   For an ephemeral Convex Preview deployment:

   ```bash
   pnpm seed:url -- https://<preview>.convex.cloud
   ```

3. Push the release branch and open a PR.
4. Wait for GitHub Actions to pass.
5. Wait for Vercel Preview deployments for Home and Budget.
6. Verify Vercel Preview against staging data:
   - Home shows sign-in only
   - approved account can sign in
   - `/budget` opens without a second sign-in
   - Budget renders seeded staging data
   - browser console shows no Convex `Unauthorized` errors

## Production cutover

1. Seed production data

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
4. Re-seed staging if the workbook source changed.
5. Seed production when preparing the cutover.
6. Deploy Convex.
7. Merge to `main`.
8. Run the production smoke test.
