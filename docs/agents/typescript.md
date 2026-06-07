# TypeScript & Code Conventions

Conventions for TypeScript across the monorepo. Most are enforced by ESLint
(`packages/eslint-config`); the rest are expectations agents and humans should
follow. Formatting (line width, quotes, semicolons, trailing commas) is owned by
Prettier — see [`prettier.config.js`](../../prettier.config.js); don't hand-format.

> ESLint runs in warnings-only mode (`eslint-plugin-only-warn`), so these rules
> surface as warnings rather than hard failures. Treat the warnings as the bar.

## Types

- **Prefer `type` aliases over `interface`** unless interface-specific behavior
  is required (declaration merging, `extends` ergonomics for public APIs).
  _Enforced:_ `@typescript-eslint/consistent-type-definitions`.
- **No `any`; prefer `unknown`** and narrow, or use a proper generic.
  _Enforced:_ `@typescript-eslint/no-explicit-any` (via tseslint recommended).
- **Prefer string-literal unions over `enum`.** Unions are erasable, tree-shake
  cleanly, and avoid `enum`'s runtime/nominal quirks.
  _Enforced:_ `no-restricted-syntax` flags `enum` declarations.
- **Use `satisfies` for config-style objects** (`const x = {…} satisfies T`)
  instead of a type annotation, so literals keep their narrow inferred types
  while still being checked against `T`. _Convention._

## Imports & modules

- **Use `import type { … }` for type-only imports.** The compiler enforces this
  via `verbatimModuleSyntax: true` (shared `tsconfig` base), and ESLint autofixes
  it. _Enforced:_ `@typescript-eslint/consistent-type-imports`.
- **Named exports only.** Avoid default exports so import names stay consistent
  and refactors are safer. _Enforced:_ `import/no-default-export`, with
  exceptions for framework files that require a default export — Next.js
  `app/` pages/layouts/route handlers/`middleware`, Vercel serverless
  entrypoints such as `api/` and `src/app.ts`, and `*.config.*` files.
- **No barrel files.** Don't create `index.ts` files whose only job is to
  re-export a directory; they hurt tree-shaking and build speed. Import from the
  source module directly. _Convention._
- **Import ordering is automatic.** _Enforced & autofixed:_
  `eslint-plugin-simple-import-sort`. Run `pnpm lint --fix` (or save in-editor)
  rather than ordering by hand.
