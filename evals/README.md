# Doma Evals

Local harness for Doma AI evals. The first slice provides shared wiring only:
JSONL dataset loading, case execution, deterministic graders, result
aggregation, and scorecard rendering.

Run the demo from the repo root:

```bash
pnpm evals
```

Run the harness foundation tests from the repo root:

```bash
pnpm evals:test
```

These scripts use Node's TypeScript stripping rather than `tsx`, so they can run
even when the package-manager preflight has not linked `node_modules/.bin`.

The demo uses generic fixture text only. Future eval datasets must keep using
generic labels for members, calendars, Telegram identifiers, schools, events,
finance accounts, and institutions.

RAY-77 adds a live weekly-meals baseline with launch-blocking deterministic
graders for locked slots, saved-recipe grounding, and unsupported leftover
claims. It runs the real agent module against generic fixtures and retains each
privacy-safe trace in memory for inspection:

```bash
WEEKLY_MEALS_AI_MODEL=openai/gpt-5.4-mini pnpm evals:weekly-meals
```

The forwarded-email first-stage dataset in `email-triage/` covers the key
launch boundary: only medium- or high-priority obligations with a high-confidence
explicit date may become reminder candidates. Its deterministic grader runs under
`pnpm evals:test`; live model scoring can follow once production examples form
a useful regression set.
