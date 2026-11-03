#!/usr/bin/env bash
# Runs the app-hosted tests in the iOS simulator against the Convex deployment and Clerk
# development instance configured in the repository's .env.local. Production keys are refused.
set -euo pipefail

scripts_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$scripts_dir/../../.." && pwd)"
read_env() { grep -E "^$1=" "$repo_root/.env.local" | head -1 | cut -d= -f2-; }

convex_url="${DOMA_CONVEX_URL:-$(read_env VITE_CONVEX_URL)}"
publishable_key="$(read_env VITE_CLERK_PUBLISHABLE_KEY)"
destination="${DOMA_IOS_DESTINATION:-$("$scripts_dir/simulator-destination.sh")}"

if [[ "$publishable_key" != pk_test_* ]]; then
  echo "Refusing: VITE_CLERK_PUBLISHABLE_KEY in .env.local is not a Clerk development key." >&2
  exit 1
fi

cd "$repo_root/apps/ios"
TEST_RUNNER_DOMA_CONVEX_URL="$convex_url" \
TEST_RUNNER_DOMA_CLERK_PUBLISHABLE_KEY="$publishable_key" \
TEST_RUNNER_DOMA_TEST_SIGN_IN_TICKET="$("$scripts_dir/mint-test-sign-in-ticket.sh")" \
  xcodebuild test -project Doma.xcodeproj -scheme Doma -destination "$destination" -quiet "$@"
