#!/usr/bin/env bash
# Fails when a screen reads a Convex subscription directly. A ConvexMobile subscription ends for
# good on its first error, so live queries go through followLiveQuery, which logs and resubscribes.
set -euo pipefail

app="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/Doma"

direct="$(grep -rnE 'for try await .* in .*\.values' "$app" --include='*.swift' --exclude='LiveQuery.swift' || true)"

if [[ -n "$direct" ]]; then
  echo "Follow live queries with followLiveQuery instead of awaiting .values directly:" >&2
  echo "$direct" >&2
  exit 1
fi
