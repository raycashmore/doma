# Conservative paste-to-items split heuristic

## Context

Pasting a block of text into the List add-item composer parses it into multiple
**list items**. The ambiguous case is _when_ a paste should split versus stay a
single item, because some single items legitimately contain commas (e.g.
"Milk, 2L", "Call mum, then dad").

## Decision

The parser uses a fixed split precedence and a single-item fallback:

1. If the pasted text contains newlines → split on newlines only (commas are
   left intact inside each line).
2. Else if it contains bullet/checkbox markers (`☐ ☑ - * • – 1.`) → split on
   those.
3. Else if it contains **two or more** commas → split on commas.
4. Otherwise → treat the whole paste as one item (today's behaviour).

We deliberately do **not** split on commas inside a multi-line paste, and a
single line with at most one comma stays one item.

## Why

Splitting is always a guess. Biasing toward _fewer, correct_ items beats
aggressive splitting that mangles single items like "Milk, 2L". The line-based
shapes people actually paste (return-separated and bullet/checkbox lists) carry
their own delimiters, so commas within those lines are content, not separators.
The comma path exists only for the genuinely flat "bananas, apples, oats" case,
gated behind ≥2 commas so an incidental single comma never triggers a split.

## Consequences

A reasonable reader will be tempted to "fix" this by making commas always split
— that reintroduces the "Milk, 2L" bug. This ADR records that the conservatism
is intentional. A preview-and-confirm step (shown whenever ≥2 items are
detected) is the safety net for the remaining mis-parses, so the heuristic does
not need to be perfect.
