#!/usr/bin/env bash
# Prints a 10-minute Clerk sign-in ticket for the live iOS tests and simulator sign-in, for the
# user `dev-test-user-id.sh` picks. The instance signs people in with Google only, so a ticket
# needs a Google-linked user. The tests touch only the personal fixture list they create and delete.
set -euo pipefail

scripts_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$scripts_dir/../../.." && pwd)"
user_id="$("$scripts_dir/dev-test-user-id.sh")"
secret_key="$(grep -E '^CLERK_SECRET_KEY=' "$repo_root/.env.local" | head -1 | cut -d= -f2-)"

curl -sS --fail-with-body -H "Authorization: Bearer $secret_key" -H "Content-Type: application/json" \
  -X POST https://api.clerk.com/v1/sign_in_tokens \
  -d "{\"user_id\":\"$user_id\",\"expires_in_seconds\":600}" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
