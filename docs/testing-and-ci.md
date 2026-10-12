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

## Dependency security checks

Run `pnpm audit` after dependency updates, then verify with `pnpm ci:checks`.
Security overrides in `pnpm-workspace.yaml` keep transitive packages on patched
versions where upstream constraints lag behind. Remove an override when upstream
releases resolve the patched version without it.

As of 12 October 2026, the remaining advisory is
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in
`braces@3.0.3`, reached through the development dependency
`@next/eslint-plugin-next → fast-glob → micromatch`. No patched release is
available on npm. This path handles repository lint globs; it does not handle
application request input. Keep the finding visible in audit output and update
when a fixed release becomes available.

The local spreadsheet seed script uses SheetJS 0.20.3 from the
[official CDN](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/)
because the npm `xlsx` package stops at vulnerable version 0.18.5. Its tarball URL
and integrity hash are recorded in the lockfile.
