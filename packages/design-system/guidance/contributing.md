# Contribute a pattern

Start with an existing pattern and its native references. Reuse guidance when the user job fits. If a local alternative fits better, record the rationale; do not force every framework into one component API.

Edit the pattern's contract for states, rules, mappings and evidence references. Edit its guide for purpose, use/avoid, rationale, composition and accessibility. The site generates normative tables from the contract. Keep examples generic and add actual references only when their files and Pencil nodes exist.

## Review and promotion

Proposed records remain proposed until maintainer review approves shared adoption. Must rules bind an approved pattern's adopters. A generator cannot grant approval. Review behaviour, visual evidence, accessibility, affected native implementations and representations together. The dedicated design-system Pencil file is a maintained visual representation; canonical contracts and tokens live in the repository.

Version shared contracts as APIs, independently of the schema format version. Removed or renamed states and roles, narrowed promises, changed must rules, or changes to token meanings, types or units are breaking changes even in 0.x. Record affected adopters and migration steps before promotion. Visual value changes still require review.

## Maintainer commands

From the repository root:

```sh
pnpm --filter @repo/design-system generate
pnpm --filter @repo/design-system check
pnpm --filter design-guide build
pnpm --filter design-guide dev
```

Generate explicitly updates the committed agent catalogs. Check validates references and compares catalog bytes without writing. Build checks before assembling ignored pages; it never repairs a stale catalog. Reference checks run without caching so a removed native file still fails. Build revisions come from the actual checkout; dirty drafts display local paths instead of misleading commit links. Restart the local guide command after changing canonical content.

Agents can read the local catalog, contract and prose without starting the site. See the design-system package README for paths and checks.
