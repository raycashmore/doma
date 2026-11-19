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

For forwarded-email work, treat sender addresses, subjects, bodies,
attachments, extracted facts, and due-date evidence as private source data.
Use generic messages in committed tests and evals. Agent traces may retain
typed outcome metadata and token usage, but must not copy raw email content.

The repository is public, so PR titles, bodies and comments are public too. Describe the code and
its evidence in generic terms: "a device", "the simulator", "production needs `X` set". Leave out
which devices the household uses, who uses them, deployment names and URLs, and the current state
of production configuration.

## Device login secrets

Secret material means device secrets, their hashes, issued device tokens, the device signing key
(`DEVICE_JWT_PRIVATE_KEY`), `CLERK_SECRET_KEY`, and anything read from the Keychain. These rules bind
every agent working on device login (see [Auth](../auth.md#device-login)):

1. Never print, log or echo secret material, in code or in the session. In code that covers `print`,
   `os_log`/`Logger`, `console.log`, error messages, thrown errors, crash text, analytics and test
   output. Errors say "device not linked" or "token swap failed", with no fragment of the value.
2. Never put an `Authorization` header, or a request or response body from `devices/login:exchange`
   or `devices/login:link`, into logs or errors.
3. Never run commands that reveal secret material in session output: `npx convex env get` or
   `env list` for these variables (use `pnpm convex:env-names`), `security find-generic-password -w`,
   dumping the simulator Keychain, or calling the exchange with a real secret and showing the reply.
4. Set keys only with `pnpm --filter @repo/convex device-login:keys`, which never displays them.
   Agents set only the local development deployment. The owner sets production; never paste
   production keys into chat, issues, commits or PRs.
5. Tests use throwaway keys generated in the test and fake secrets. Never commit real or reusable key
   material; fixture keys must be obviously test-only.
6. Convex functions never return `tokenHash` or a secret, except the one-time return from
   `devices/login:link`.
7. If secret material appears in output by accident, stop and tell the owner. The fix is to revoke
   the device or rotate the signing key.
