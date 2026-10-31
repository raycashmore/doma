# Issue Tracker: Linear

Issues and PRDs for this repo live in Linear in the `Doma` project on the `Ray` team.

## Conventions

- Create a new issue in Linear on the `Ray` team and attach it to the `Doma` project.
- Read and update issues directly in Linear.
- Preserve source context in the issue description or links when migrating from another tracker.
- Use Linear's workflow states for delivery state:
  - `Backlog` for unsorted or future work
  - `Todo` for ready work
  - `In Progress` for active work
  - `Done` for completed work
  - `Canceled` for work that should not be actioned
- The triage labels for skill-driven workflows are:
  - `needs-triage`
  - `needs-info`
  - `ready-for-agent`
  - `ready-for-human`
  - `wontfix`

These labels are used by the engineering skills as the canonical triage vocabulary for this repo.

## When a skill says "publish to the issue tracker"

Create a Linear issue in the `Doma` project on the `Ray` team.

For new product work, use `/ray-next-feature` as the preferred discovery and planning workflow. Planning artifacts should be represented as Linear PRDs/issues, not committed `docs/superpowers/` specs. `docs/superpowers/` is ignored local scratch for this repo.

## When a skill says "fetch the relevant ticket"

Open the referenced Linear issue and read its title, description, labels, state, comments, and linked documents.

Retrieve each shared source once per inspection, keeping the full response locally
when it is large. Show only the relevant sections; follow comment pagination.
Refresh when feedback or state may have changed. Record unavailable endpoints and
the working access route in the handoff; retry after an access change or new evidence.

Linear owns planning; the repository owns reusable operating guidance.

## Planning records

Find these with the Linear tools by the reference shown.

| Record                                    | Linear reference                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Project                                   | "Doma" (Ray team)                                                        |
| Now, next and later (ranking and handoff) | Project document "Doma — now, next and later"; created by first grooming |

If the document does not exist, the ranking is missing: run `ray-groom-backlog`
before selecting work, and record the document's link in this table.

## Start or resume

1. Read the **now, next and later** document: its ranking, last-groomed date
   and current handoff. Then read the in-progress or Now issue and existing
   brief. Recover evidence, remaining gates, authority and the resume action
   before choosing work.
2. At grooming or expansion, read relevant feedback. Load further history for
   unresolved questions.
3. Verify consequential completion claims against linked evidence. Historical
   Done issues are history, not current runtime proof or instructions to reopen
   them.

Reuse inspected sources until they change or another writer may have changed
them. Recover missing mutable state after compaction without repeating settled
orientation.

## Record ownership

| Record                           | Owns                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| Current handoff                  | Current outcome, selected task, revision, environment, gates, authority and resume action   |
| Ranking (same document)          | Now/Next/Later/Not doing order, last-groomed date and slices completed since; grooming only |
| Issue                            | Scope, acceptance criteria, state, dependencies and links                                   |
| Existing brief, or issue if none | Decisions, dated evidence, three verdicts and retrospective when useful                     |
| Feedback record                  | Original observations, interpretations, dispositions and outcome links                      |

Keep one authoritative home for each fact. Link detail rather than copying status.
Use [triage labels](triage-labels.md) when triage needs labels.

## Checkpoint

At handoff, pause, material direction/acceptance change or closeout:

1. Save new evidence and decisions in the issue/brief, including the three
   [verdicts](product-oversight.md#accept-the-outcome).
2. Update issue metadata only when scope, state or dependencies change.
3. Replace the current handoff once with a short result, evidence link,
   remaining gates, authority source and resume action. When the slice is
   complete, point to the ranking and add one to the slices-since-grooming count;
   leave the ranking itself to [grooming](product-oversight.md#groom-the-backlog).
   Replace rather than append: dated detail belongs in the evidence record, with
   [reporting conventions](progress-reporting.md).
4. File ideas for new work as Backlog issues labelled `needs-triage`, within
   tracker write authority, for the next grooming.

Check every write result before dependent updates or claims of success. If
saving fails, report the stale record and preserve a safe chat handoff. Routine
chat updates during an uninterrupted build need no duplicate tracker narration.

Apply the owner's existing authorization to its named actions and destinations.
This guide creates no standing write, messaging, publication, production-data
or spending grant. Record task-specific authority in the handoff with its
source and limits.

## Feedback

Search for an existing Doma feedback record when concrete feedback needs
tracking. Reuse it, or create a project-linked inbox. An empty speculative inbox
is unnecessary. Keep explicit owner instructions as instructions; other
observations are evidence, not automatic build commissions.

Before selecting work, read relevant unresolved feedback and all comment pages,
including replies. Keep original wording, interpretation as a hypothesis,
disposition and reason, revisit condition, linked work and observed outcome.
Reply beside the source only within existing messaging authority. At acceptance
revisit the feedback tied to the slice.

Apply [privacy guidance](privacy.md) to Linear as well as Git: use generic
account and institution labels in issues, briefs and comments.
