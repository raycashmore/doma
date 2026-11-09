#!/usr/bin/env bash
# Lists Convex environment variable names without their values. Some values span several lines,
# so filtering `convex env list` by line still prints secrets. Pass --prod for production.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../packages/convex"
npx convex env list "$@" | grep -oE '^[A-Z][A-Z0-9_]+=' | tr -d '='
