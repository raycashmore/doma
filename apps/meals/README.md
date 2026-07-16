# Meals

Meals is Doma's standalone household cookbook, mounted at `/meals`. It owns
recipes; Lists continues to own shopping-list items.

The current foundation provides the independently deployable TanStack Start
zone, shared navigation, Clerk and Convex integration, and the Meals-owned
recipe model. Recipe collection, detail, and editing screens will be added from
the approved Pencil designs. The root route remains deliberately empty until
that design source is available to inspect.

## Local development

Run the app without a Clerk session for zone and shell work:

```bash
pnpm --filter meals dev:no-auth
```

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
