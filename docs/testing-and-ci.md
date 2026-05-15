# Testing & CI

## Test Setup

- **Runner:** Vitest with jsdom environment
- **Location:** `apps/budget/src/**/*.{test,spec}.{ts,tsx}`
- **Libraries:** `@testing-library/react` and `@testing-library/dom`
- **Workspace run:** `pnpm --filter budget test`
- **Caching:** Tests are not cached in Turbo (`"cache": false`)

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main` and PRs:

1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Format check (`pnpm format --check`)
3. Lint (`pnpm lint`)
4. Type check (`pnpm check-types`)
5. Test (`pnpm test`)
6. Build (`pnpm build`)

All steps must pass. The pipeline cancels in-progress runs when a new commit is pushed to the same branch.
