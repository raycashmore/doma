# LLM intent router for free-text bot messages

## Context

The Telegram bot now serves more than one **capability** (lists, schedule,
briefing). A free-text message such as "we're out of milk" or "what's on today"
carries no slash command, so the gateway must decide which single capability
should handle it. Slash commands (`/schedule`, `/briefing`) already name their
capability directly and must keep working without any model in the loop.

The naive option is to keep routing all free text to one capability (Lists), but
that misfires every schedule-style question and blocks adding further
capabilities.

## Decision

A **classify-only** intent router runs inside `apps/api-bot`. It performs
two-stage routing: the router PICKS exactly one registered capability (or
`none`), and the chosen capability does its own deep understanding (item
parsing, day resolution). The router never parses, rewrites, or extracts content
from the message — the selected capability receives the original message text
unchanged.

Concretely:

- **Slash commands bypass the router.** A leading `/word` dispatches directly to
  that capability with no LLM request.
- **Free text is classified to one capability or `none`.** The router asks an
  injected provider for a structured `{ capability, confidence }`, constrained by
  a strict JSON schema to the registered capability names plus `none`. It then
  deterministically validates the response and falls back to `none` on malformed
  output, an unregistered capability, an invalid confidence signal, a timeout, or
  a provider failure.
- **`none` returns a capabilities hint.** Unknown or off-topic input creates
  nothing; the bot replies listing what it can do.
- **The provider is injected.** The router lives in api-bot with direct LLM
  access (one hop, no Convex round-trip). The real OpenAI provider is wired
  separately and bounded by a configurable timeout; unit tests pass a fake with
  no network.

## Why

Routing belongs at the gateway because that is where the message first arrives
and where the capability registry lives; a Convex round-trip would add a hop
purely to reach a model the gateway can call directly. Classify-only keeps the
router a thin selector: each capability already owns its parsing, so duplicating
that understanding in the router would be a second source of truth to keep in
sync. Returning `none` rather than guessing protects mutating capabilities — an
ambiguous message should teach the user, not silently write list items.

The injected provider keeps the seams testable: the deterministic
parse-and-fallback is unit-tested without a network, and the real transport stays
a thin, replaceable adapter.

## Consequences

The router depends on an LLM provider being configured (`OPENAI_API_KEY` and
`INTENT_ROUTER_AI_MODEL`); without them the gateway has no classifier and every
free-text message returns the capabilities hint rather than routing. A reasonable
reader tempted to "make the router smarter" by having it parse or rewrite the
message should resist: that reintroduces the dual-source-of-truth problem this
ADR avoids. Adding a new capability is a registry change plus its own parsing;
the router picks it up through the enumerated schema with no routing rewrite.
