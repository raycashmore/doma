# Git Workflow

Before committing, run:

```bash
pnpm format
pnpm lint
pnpm check-types
pnpm test
```

Do not commit generated or local-only files unless the task explicitly requires them. Use `.gitignore` for files that contain private spreadsheet details.
