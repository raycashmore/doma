#!/usr/bin/env bash
# Fails unless the tree is clean and this branch's PR head is the local head, so a PR is never
# reported ready while commits exist only on this machine.
set -euo pipefail

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Uncommitted changes. Commit or stash them first." >&2
  exit 1
fi
local_head="$(git rev-parse HEAD)"
pr_head="$(gh pr view --json headRefOid -q .headRefOid)"
if [[ "$pr_head" != "$local_head" ]]; then
  echo "PR head ${pr_head:0:7} is not local head ${local_head:0:7}. Push, or pull what is missing." >&2
  exit 1
fi
echo "PR head matches local head ${local_head:0:7}."
