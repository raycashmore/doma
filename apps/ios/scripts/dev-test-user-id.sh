#!/usr/bin/env bash
# Prints the Clerk development user the iOS test scripts act as: DOMA_IOS_TEST_CLERK_USER_ID,
# or the instance's only Google-linked user. Refuses anything but a development key (sk_test_).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
secret_key="$(grep -E '^CLERK_SECRET_KEY=' "$repo_root/.env.local" | head -1 | cut -d= -f2-)"

if [[ "$secret_key" != sk_test_* ]]; then
  echo "Refusing: CLERK_SECRET_KEY in .env.local is not a Clerk development key." >&2
  exit 1
fi

if [[ -n "${DOMA_IOS_TEST_CLERK_USER_ID:-}" ]]; then
  echo "$DOMA_IOS_TEST_CLERK_USER_ID"
  exit 0
fi

curl -sS --fail-with-body -H "Authorization: Bearer $secret_key" "https://api.clerk.com/v1/users?limit=100" |
  python3 -c '
import json, sys
users = [u["id"] for u in json.load(sys.stdin) if u["external_accounts"]]
if len(users) != 1:
    sys.exit(f"Expected one Google-linked development user, found {len(users)}; set DOMA_IOS_TEST_CLERK_USER_ID.")
print(users[0])'
