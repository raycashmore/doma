# Delivery workflow

## Prepare

Read the [current handoff, selected issue and brief](issue-tracker.md#start-or-resume).
Use [product oversight](product-oversight.md) for selection or scope changes.
Read [privacy](privacy.md), [testing policy](testing-policy.md),
[TypeScript conventions](typescript.md), the [repository map](repo-map.md) and
the applicable [domain guidance](domain.md). Inspect the affected implementation
before changing it; docs may describe intentions rather than current behavior.

Name the required acceptance environment and evidence before building. Confirm
external access, private-data scope and deployment effects only where the
selected task depends on them. Carry existing grants forward with their limits;
an unknown fact blocks only dependent work. Keep seed-data proof and any later
production acceptance as separate gates.

## Build and verify

Use the existing checkout. Substantial work belongs on a feature branch; create
a worktree only on explicit owner instruction. Preserve unrelated edits and keep
one cohesive slice per local commit.

Follow [Git Workflow](git-workflow.md) for the pre-commit gate and
[Commands](commands.md) for scripts. Run targeted behavioral checks while
working, then one broader pass; repeat for new changes or unresolved failures.
For UI work, add [browser verification](browser-verification.md) against the
running app.

For documentation-only work, check changed Markdown formatting, links/anchors
and the diff. Application checks are warranted when executable commands,
configuration or code change. Standards/Spec code review uses a fixed base/head
diff and accepted brief when applicable; product review answers a different
question about usefulness. Scale review to the change.

Local checks do not prove hosted behavior. Record which surface and environment
were exercised. Production Convex data and real-data seeding need applicable
owner authority; preserve unresolved gates rather than silently running them or
substituting seed-data proof.

## Publication

Before pushing or opening a PR, inspect the current workflow events and the
actual deployment target. `.github/workflows/ci.yml` runs on pull requests to
and pushes to `main`; it does not establish hosted behavior. Explain material
automatic effects and apply existing authority to them.

Run the [Pre-PR Docs Audit](pre-pr-doc-audit.md) and the
[privacy checks](privacy.md), including commit metadata. A local commit, PR,
main merge, production deployment and production data change are distinct
actions; use the owner's grant for each. Attach any created PR to the chat
through the app tool.

## Close out

Review the scoped diff and checks, record the three
[verdicts](product-oversight.md#accept-the-outcome), then save one
[tracker checkpoint](issue-tracker.md#checkpoint). Use
[progress reporting](progress-reporting.md) for the owner summary. Keep remaining
acceptance gates and authority available to the next chat. The ranking, not this
slice, decides what follows; file new ideas for
[grooming](product-oversight.md#groom-the-backlog).
