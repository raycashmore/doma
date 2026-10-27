#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

export CI="${CI:-true}"

# Compare with the starting diff so local checks also accept intentional edits.
initial_diff="$(mktemp)"
final_diff="$(mktemp)"
trap 'rm -f "$initial_diff" "$final_diff"' EXIT
git diff --no-ext-diff --no-textconv --binary HEAD > "$initial_diff"

pnpm format:check
pnpm turbo run lint --force
pnpm turbo run check-types --force
pnpm turbo run test --force
pnpm turbo run build --force

pnpm --filter design-guide test:browser

git diff --no-ext-diff --no-textconv --binary HEAD > "$final_diff"
if ! cmp -s "$initial_diff" "$final_diff"; then
  echo "Verification changed tracked files. Inspect git diff before committing." >&2
  exit 1
fi
