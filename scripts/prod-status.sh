#!/usr/bin/env bash
# Read-only: reports whether Convex functions are deployed to production, so a gate is never
# assumed from a merge. Prints no deployment URL. Convex offers no CLI view of deploy times or crons.
#   pnpm prod:status email/retentionCleanup email/capture
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Usage: pnpm prod:status <module-or-function>..." >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
spec="$(mktemp)"
trap 'rm -f "$spec"' EXIT

(cd "$repo_root/packages/convex" && npx convex function-spec --prod) >"$spec" 2>/dev/null

status=0
for name in "$@"; do
  if grep -q "\"identifier\": *\"$name" "$spec"; then
    echo "live     $name"
  else
    echo "missing  $name"
    status=1
  fi
done
exit "$status"
