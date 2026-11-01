#!/usr/bin/env bash
# Prints a 10-minute Clerk sign-in ticket for the live iOS tests.
# Refuses anything but a Clerk development instance (sk_test_ key). The instance
# signs people in with Google only, so a ticket needs a Google-linked user: set
# DOMA_IOS_TEST_CLERK_USER_ID, or the script uses the instance's only such user.
# The tests touch only the personal fixture list they create and delete.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
secret_key="$(grep -E '^CLERK_SECRET_KEY=' "$repo_root/.env.local" | head -1 | cut -d= -f2-)"

if [[ "$secret_key" != sk_test_* ]]; then
  echo "Refusing: CLERK_SECRET_KEY in .env.local is not a Clerk development key." >&2
  exit 1
fi

clerk() {
  curl -sS --fail-with-body -H "Authorization: Bearer $secret_key" -H "Content-Type: application/json" "$@"
}

user_id="${DOMA_IOS_TEST_CLERK_USER_ID:-}"
if [[ -z "$user_id" ]]; then
  user_id="$(clerk "https://api.clerk.com/v1/users?limit=100" | python3 -c '
import json, sys
users = [u["id"] for u in json.load(sys.stdin) if u["external_accounts"]]
if len(users) != 1:
    sys.exit(f"Expected one Google-linked development user, found {len(users)}; set DOMA_IOS_TEST_CLERK_USER_ID.")
print(users[0])')"
fi

clerk -X POST https://api.clerk.com/v1/sign_in_tokens \
  -d "{\"user_id\":\"$user_id\",\"expires_in_seconds\":600}" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
