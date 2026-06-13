# Privacy

Never commit real account names, financial institution names, workbook-specific labels, or other identifying details copied from the source spreadsheet.

Use generic labels in database schemas, docs, README files, tests, fixtures, screenshots, and any other files checked into git. Prefer names like `account1`, `institution1`, and `brokerageAccount`.

Keep files with real spreadsheet details local and ignored by git. If a script, note, fixture, export, or generated artifact must include specific account or institution names, add an ignore rule before creating it and verify it is not tracked:

```bash
git check-ignore -v <path>
git status --short
```

For bot and notification work, treat Telegram IDs, chat IDs, bot tokens,
webhook secrets, private message text, and notification payloads as private.
Tests and docs should use generic IDs and messages. Telegram account linking
must only accept private chats; never store a group or supergroup chat as a
finance notification destination.

For schedule and morning briefing work, also treat calendar IDs, service-account
keys, real member names, school names, event descriptions, requirement notes,
recipient user IDs, AI model credentials, and generated briefing text as
private. Committed examples should use generic labels such as `memberA`,
`requirements-calendar`, `user_123`, `bot.example.com`, and neutral requirement
text like "Bring sports bag."
