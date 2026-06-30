#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

export CI="${CI:-true}"

pnpm format:check
pnpm turbo run lint --force
pnpm turbo run check-types --force
pnpm turbo run test --force
pnpm turbo run build --force
