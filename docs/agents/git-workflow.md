# Git Workflow

Before committing, run all four — this is the gate CI enforces, so a green local run means a green PR:

```bash
pnpm format        # writes Prettier formatting (CI runs format:check, which only verifies)
pnpm lint          # ESLint
pnpm check-types   # tsc
pnpm test
```

These are four separate tools, not one. In particular `lint` (ESLint) does **not** check Prettier formatting — code can pass `pnpm lint` while `pnpm format:check` fails. Always run `pnpm format` (or at least `pnpm format:check`) as part of the gate; do not treat a passing `lint` as covering formatting. When defining a task's "full gate" anywhere (e.g. an implementation plan), include all four commands.

Before opening or updating a PR, also run the [Pre-PR Docs Audit](pre-pr-doc-audit.md). Update impacted docs in the same PR, or mention in the PR notes that no docs changed because the audit found nothing stale.

Do not commit generated or local-only files unless the task explicitly requires them. Use `.gitignore` for files that contain private spreadsheet details.
