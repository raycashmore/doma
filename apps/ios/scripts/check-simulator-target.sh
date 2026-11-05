#!/usr/bin/env bash
# Fails unless a simulator build uses a local Convex URL and a Clerk development key, because
# Device.xcconfig also applies to Debug builds and a walk-through would write to production.
# Checks the given Info.plist, or the current Debug simulator build. Prints no values.
set -euo pipefail

ios_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plist="${1:-}"

if [[ -z "$plist" ]]; then
  products="$(xcodebuild -project "$ios_dir/Doma.xcodeproj" -scheme Doma -sdk iphonesimulator -configuration Debug \
    -showBuildSettings 2>/dev/null | sed -n 's/^ *BUILT_PRODUCTS_DIR = //p' | head -1)" || true
  plist="$products/Doma.app/Info.plist"
fi

if [[ ! -f "$plist" ]]; then
  echo "No simulator build found. Build the Doma scheme first." >&2
  exit 1
fi

read_key() { /usr/libexec/PlistBuddy -c "Print :$1" "$plist" 2>/dev/null || true; }

if [[ ! "$(read_key DomaConvexURL)" =~ ^https?://(127\.0\.0\.1|localhost)(:|/|$) ]]; then
  echo "Refusing: this build does not use a local Convex URL. Check Config/Device.xcconfig." >&2
  exit 1
fi
if [[ "$(read_key DomaClerkPublishableKey)" != pk_test_* ]]; then
  echo "Refusing: this build does not use a Clerk development key. Check Config/Device.xcconfig." >&2
  exit 1
fi
echo "Simulator build targets local Convex and development Clerk."
