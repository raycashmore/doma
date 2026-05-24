# Doma

Personal finance dashboard built as a Turborepo monorepo with Vercel Multi-Zones, Convex, and Clerk.

Use `pnpm` (`packageManager`: `pnpm@9.0.0`).

## Essential Rules

- Protect private finance data: use generic account and institution labels in anything checked into git. See [Privacy](docs/agents/privacy.md).
- Use the repo scripts for build, lint, typecheck, tests, and Convex work. See [Commands](docs/agents/commands.md).
- Before committing, follow [Git Workflow](docs/agents/git-workflow.md).

## Task-Specific Instructions

- [Testing policy](docs/agents/testing-policy.md)
- [Browser Verification](docs/agents/browser-verification.md)
- [Repository Map](docs/agents/repo-map.md)

## Agent skills

### Issue tracker

Issues and PRDs for this repo live in Ray's Notion workspace in the `Doma Backlog` database. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the five canonical triage states as its issue status vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo is treated as a single-context repo. Skills should look for one root `CONTEXT.md` and one root `docs/adr/` when those files exist. See `docs/agents/domain.md`.
