# Git Workflow

Before committing, run:

```bash
pnpm format
pnpm lint
pnpm check-types
pnpm test
```

Before opening or updating a PR, also run the [Pre-PR Docs Audit](pre-pr-doc-audit.md). Update impacted docs in the same PR, or mention in the PR notes that no docs changed because the audit found nothing stale.

Do not commit generated or local-only files unless the task explicitly requires them. Use `.gitignore` for files that contain private spreadsheet details.
