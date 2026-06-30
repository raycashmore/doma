#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

expected_package_manager="$(node -p "require('./package.json').packageManager")"
expected_pnpm_version="${expected_package_manager#pnpm@}"
actual_pnpm_version="$(pnpm --version)"

if [[ "$expected_package_manager" != pnpm@* ]]; then
  echo "package.json packageManager must declare pnpm, got: $expected_package_manager" >&2
  exit 1
fi

if [[ "$actual_pnpm_version" != "$expected_pnpm_version" ]]; then
  echo "Expected pnpm $expected_pnpm_version, but PATH resolves pnpm $actual_pnpm_version." >&2
  echo "Run: corepack enable pnpm" >&2
  exit 1
fi

export CI="${CI:-true}"

pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm build
