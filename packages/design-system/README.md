# Doma design-system guidance

Start with [the local pattern catalog](generated/catalog.md). Search its JSON or Markdown, then read both the linked `contract.json` and `guide.md`. Paths inside the JSON catalog are repository-relative. The catalog works without a server or network access.

For a new feature, find the closest user job, inspect its platform mappings and known gaps, and follow the native source/test references. Proposed guidance does not assert passing checks or maintainer approval. Shared patterns guide reuse across frameworks; native applications own their renderers.

## Browse locally

From the repository root, run `pnpm --filter design-guide dev` and open <http://127.0.0.1:3007>. Search, navigation and pages come from the same canonical content. Restart after editing sources. See [the guide app README](../../apps/design-guide/README.md).

## Maintain the sources

- `patterns/<id>/contract.json`: typed rules, states, roles and platform/evidence mappings.
- `patterns/<id>/guide.md`: purpose, use/avoid, rationale, composition and accessibility.
- `guidance/`: start and contribution pages.
- `../tokens/source/` and `../tokens/profile.json`: role values, variants and conversion policy. See the [token package](../tokens/README.md) for generation and native adoption.
- `generated/catalog.{json,md}`: deterministic committed indexes. Use `generate` to update.
- `dist/guide/`: ignored composed pages with generated normative tables and actual build revision.

Run `pnpm --filter @repo/design-system generate` after editing catalog inputs. Run `pnpm --filter @repo/design-system check` to validate source shape, native paths, rule/state/token references and any real Pencil node references, then compare committed catalogs without writes. Extra or missing catalog artifacts fail; generation never removes unexpected files. `test` runs this check and regression fixtures in disposable directories. `build` checks then assembles ignored pages, without repairing committed catalogs.

Token references use the token package’s shared validation: a pinned DTCG schema plus the narrower Doma profile. Generated CSS/Kotlin and the desired Pencil manifest are adopted by the two native call sites; token checks reject stale committed outputs. This remains a bounded profile, not a full DTCG implementation. The dedicated Pencil file and visual proof belong to RAY-229; design references remain empty until real nodes and exports exist.

Contract versions describe shared promises; schema versions describe data format. Record breaking changes even in 0.x with affected adopters and migrations. Approval is a maintainer review decision. Keep private data out of contracts, examples and exports.
