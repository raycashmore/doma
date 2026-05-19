# Privacy

Never commit real account names, financial institution names, workbook-specific labels, or other identifying details copied from the source spreadsheet.

Use generic labels in database schemas, docs, README files, tests, fixtures, screenshots, and any other files checked into git. Prefer names like `account1`, `institution1`, and `brokerageAccount`.

Keep files with real spreadsheet details local and ignored by git. If a script, note, fixture, export, or generated artifact must include specific account or institution names, add an ignore rule before creating it and verify it is not tracked:

```bash
git check-ignore -v <path>
git status --short
```
