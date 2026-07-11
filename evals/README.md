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

Run the weekly meal-planning launch-blocking suite:

```bash
pnpm evals:meals
```

These scripts use Node's TypeScript stripping rather than `tsx`, so they can run
even when the package-manager preflight has not linked `node_modules/.bin`.

The demo uses generic fixture text only. Future eval datasets must keep using
generic labels for members, calendars, Telegram identifiers, schools, events,
finance accounts, and institutions.
