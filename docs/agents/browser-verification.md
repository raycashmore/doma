# Browser Verification

If local Playwright or browser verification is blocked by Clerk sign-in, use the `dev:no-auth` scripts:

```bash
pnpm --filter home dev:no-auth
pnpm --filter budget dev:no-auth
```

These scripts start the apps with `VITE_CLERK_PUBLISHABLE_KEY` unset, which makes `@repo/shell`'s `AuthGate` pass through in local development.
