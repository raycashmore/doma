# Issue Tracker: Notion

Issues and PRDs for this repo live in Ray's Notion workspace in the `Doma Task Tracker` database.

## Conventions

- Create a new issue by adding a new page to the `Doma Task Tracker` database.
- Read and update issues directly in the Notion database.
- The issue status vocabulary for skill-driven triage is:
  - `needs-triage`
  - `needs-info`
  - `ready-for-agent`
  - `ready-for-human`
  - `wontfix`

These statuses are used by the engineering skills as the canonical triage workflow for this repo.

## When a skill says "publish to the issue tracker"

Create a new page in the `Doma Task Tracker` Notion database.

## When a skill says "fetch the relevant ticket"

Open the referenced page in the `Doma Task Tracker` Notion database and read its properties and content.
