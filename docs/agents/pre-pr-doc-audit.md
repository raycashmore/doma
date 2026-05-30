# Pre-PR Docs Audit

Before opening or updating a PR, check whether the branch changed behavior,
commands, deployment, architecture, privacy posture, or agent workflow.

Update the matching docs in the same PR when they are affected:

- `README.md` for repo overview, setup, local development, and user-facing project framing.
- `AGENTS.md` for repo-wide agent instructions.
- `docs/agents/*.md` for agent-only workflows, commands, privacy rules, and verification guidance.
- `docs/architecture.md` for app boundaries, multi-zone routing, backend ownership, and generated-file rules.
- `docs/deployment.md` for Vercel, Clerk, Convex, Telegram, Upstash, environment variables, and production/preview behavior.
- Feature docs such as `docs/auth.md`, `docs/frontend.md`, `docs/convex-backend.md`, `docs/offline.md`, and `docs/testing-and-ci.md` when their area changes.

Use this quick checklist:

1. Run `git diff --stat main...HEAD` and identify changed apps, packages, commands, env vars, routes, and public behavior.
2. Check whether `README.md` is now stale for setup, local dev, commands, architecture summary, or the repo's visible feature set.
3. Search existing docs for the changed terms with `rg` before adding new docs.
4. Update docs close to the source of truth instead of duplicating long explanations.
5. Keep private finance data, bot tokens, Telegram IDs, chat IDs, and real institution/account labels out of examples.
6. Include docs-only verification in the PR notes when the audit finds no doc changes are needed.

For bot gateway changes, always re-check the privacy notes and deployment docs.
Telegram account linking must stay limited to private chats, and pairing is
enabled only when the bot gateway runs with `VERCEL_ENV=production`.
