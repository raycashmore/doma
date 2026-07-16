# Meals

Meals is Doma's standalone household cookbook, mounted at `/meals`. It owns
recipes; Lists continues to own shopping-list items.

The app provides an independently deployable TanStack Start zone, shared
navigation, Clerk and Convex integration, and the Meals-owned recipe model. Its
Pencil-based cookbook screens support browsing, searching, filtering, creating,
viewing, and editing recipes. `/meals/week` is reserved with an explicit
placeholder for future weekly planning.

## Local development

Run the app without a Clerk session for zone and shell work:

```bash
pnpm --filter meals dev:no-auth
```

No-auth fixture mode is available only in local development and persists
generic recipes in local storage. Production fails closed when Clerk or Convex
configuration is missing.

Run its checks:

```bash
pnpm --filter meals build
pnpm --filter meals check-types
pnpm --filter meals lint
pnpm --filter meals test
```

## Recipe boundary

`packages/convex/convex/meals/` owns authenticated household recipe queries and
mutations. A recipe keeps its name, description, preparation time, serving
label, suitability tags, ordered ingredient lines, and instructions. Ingredient
amounts are display content: Meals does not parse, scale, normalise, or model
pantry state.
