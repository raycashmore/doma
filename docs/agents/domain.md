# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repo root, if it exists.
- `docs/adr/` at the repo root, if it exists.

If these files do not exist, proceed silently. Do not block work or suggest creating them upfront.

## File structure

This repo is configured as a single-context repo.

```text
/
├── CONTEXT.md
├── docs/adr/
└── apps/
```

## Use the glossary's vocabulary

When naming a domain concept in an issue, proposal, or test, prefer the terminology defined in `CONTEXT.md`.

## Flag ADR conflicts

If a proposal or implementation contradicts an existing ADR, call that out explicitly instead of silently overriding it.
