# Bot creates list items then confirms (no preview, no undo)

## Context

The Telegram bot turns a free-text message into **list items** in a **household
user**'s **default list** (or, in later slices, a named list). Two interaction
models were on the table:

- **Preview-then-confirm**, as the in-app composer uses (ADR-0001): show the
  parsed items and wait for a tap before writing.
- **Create-then-confirm**: write the items immediately and reply echoing exactly
  what was added and where.

The bot runs over an asynchronous chat transport, not a live UI. A preview turns
a one-shot message into a multi-turn exchange and forces the bot to hold pending
conversational state between messages.

## Decision

The bot **creates the items immediately, then confirms**. One inbound message
produces one outbound reply that lists the target **list** and every item title
that was added (and, once named-list resolution lands, a clear note when the
**default list** was used as a fallback). There is **no preview step and no
undo** in v1.

Guardrails replace the preview's safety role:

- If nothing usable is parsed → create nothing, reply asking the user to
  rephrase.
- If the user has no **default list** and named no resolvable list → create
  nothing, reply asking them to set a default.

## Why

In async chat, immediacy is the feature: "we're out of milk" should land in the
list without a second round-trip. Confirming the exact titles after the write
gives the user the same misread-detection a preview would, without pending state
or a conversational protocol. The capture is cheap to correct in the Lists app,
so optimising for zero-friction capture beats optimising for pre-write review.

This is a deliberate divergence from ADR-0001's preview-then-confirm, justified
by the different context (async chat vs. a live composer). ADR-0001's
deterministic paste-split heuristic is unchanged and stays a Lists-composer
concern; it is not shared across the bot's HTTP boundary.

## Consequences

There is no undo, so a wrong capture is corrected by editing the list, not by
replaying the message. Adding undo or preview later would require introducing
pending-action state, which this ADR intentionally avoids for v1. A reasonable
reader tempted to "make the bot safer" by adding a confirm tap should weigh that
against the create-then-confirm reply already echoing every title.
