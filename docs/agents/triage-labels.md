# Triage Labels

This repo uses Linear labels for the five canonical triage roles. The skills may speak in terms of GitHub-style labels, Notion statuses, or generic triage states; map them to these Linear labels on issues in the `Doma` project.

| Label in skills   | Linear label      | Suggested Linear state | Meaning                                  |
| ----------------- | ----------------- | ---------------------- | ---------------------------------------- |
| `needs-triage`    | `needs-triage`    | `Backlog`              | Maintainer needs to evaluate this issue  |
| `needs-info`      | `needs-info`      | `Backlog`              | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | `Todo`                 | Fully specified, ready for an AFK agent  |
| `ready-for-human` | `ready-for-human` | `Todo`                 | Requires human implementation            |
| `wontfix`         | `wontfix`         | `Canceled`             | Will not be actioned                     |

When a skill mentions applying or checking a triage label, use the matching Linear label. Completed work should be in `Done` even if it still carries a historical triage label.
