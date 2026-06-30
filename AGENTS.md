# Doma

Personal finance dashboard built as a Turborepo monorepo with Vercel Multi-Zones, Convex, and Clerk.

Use `pnpm` via the version declared in `package.json` (`packageManager`).

## Essential Rules

- Protect private finance data: use generic account and institution labels in anything checked into git. See [Privacy](docs/agents/privacy.md).
- Use the repo scripts for build, lint, typecheck, tests, and Convex work. See [Commands](docs/agents/commands.md).
- Before opening or updating a PR, run the docs/agent instruction audit. See [Pre-PR Docs Audit](docs/agents/pre-pr-doc-audit.md).
- Before committing, follow [Git Workflow](docs/agents/git-workflow.md).
- Follow the [TypeScript & Code Conventions](docs/agents/typescript.md) when writing or editing code.

## Task-Specific Instructions

- [Testing policy](docs/agents/testing-policy.md)
- [Browser Verification](docs/agents/browser-verification.md)
- [Repository Map](docs/agents/repo-map.md)

## Agent skills

### Issue tracker

Issues and PRDs for this repo live in Linear in the `Doma` project on the `Ray` team. See `docs/agents/issue-tracker.md`.

### Planning workflow

For new product work, prefer the `/ray-next-feature` workflow: inspect Linear first, then create or update Linear PRDs and implementation issues before coding. Do not commit `docs/superpowers/` specs for this repo; they are local planning scratch and are redundant once work is represented in Linear.

### Triage labels

This repo uses the five canonical triage labels in Linear: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo is treated as a single-context repo. Skills should look for one root `CONTEXT.md` and one root `docs/adr/` when those files exist. See `docs/agents/domain.md`.
