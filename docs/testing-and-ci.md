# Testing & CI

## Test setup

- **Runner:** Vitest for workspace unit, component, and integration tests; framework-native checks where an app requires them.
- **Libraries:** Testing Library adapters match each UI framework (`@testing-library/vue`, `@testing-library/react`, and DOM helpers).
- **Workspace run:** `pnpm test`; target one package with `pnpm --filter <package> test`.
- **Caching:** Tests are not cached in Turbo (`"cache": false`).

Home tests cover derived board ordering and empty/error/loading states, notice expiry and supersession, manual-note and archive mutation states, keyboard/focus behavior, Clerk–Convex auth lifecycle, Telegram pairing, production rewrite order, and the root service-worker boundary. Browser verification uses `pnpm --filter home dev:no-auth` for privacy-safe desktop/mobile layout, navigation, focus, overflow, and console checks. Authenticated write and cross-client behavior stays in deterministic integration tests unless a safe signed-in browser session is explicitly available.

Forwarded-email coverage includes the deterministic lifecycle policy and DST arithmetic, bounded candidate selection, typed agent-result validation and persistence, high-confidence supersession, reminder creation and delivery, retry-safe legacy expiry backfill, and privacy boundaries. Tests use generic source data and assert typed outcomes rather than raw email content.

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main` and PRs:

1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Format check (`pnpm format:check`)
3. Lint (`pnpm lint`)
4. Type check (`pnpm check-types`)
5. Test (`pnpm test`)
6. Build (`pnpm build`)

All steps must pass. The pipeline cancels in-progress runs when a new commit is pushed to the same branch.

Before a PR, run `pnpm ci:checks` and complete the repository's pre-PR documentation audit. Browser verification is additional evidence for user-visible work; it does not replace the automated gates.
