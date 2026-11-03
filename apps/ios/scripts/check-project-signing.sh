#!/usr/bin/env bash
# Fails when Xcode's Signing & Capabilities screen has written personal signing values
# into the committed project. They belong in the ignored Config/Device.xcconfig.
set -euo pipefail

project="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/Doma.xcodeproj/project.pbxproj"

leaks="$(grep -nE 'DEVELOPMENT_TEAM|CODE_SIGN_ENTITLEMENTS|PRODUCT_BUNDLE_IDENTIFIER' "$project" \
  | grep -vE 'PRODUCT_BUNDLE_IDENTIFIER = "\$\(DOMA_BUNDLE_ID\)(\.tests)?";' || true)"

if [[ -n "$leaks" ]]; then
  echo "project.pbxproj contains signing values that belong in Config/Device.xcconfig:" >&2
  echo "$leaks" >&2
  echo "Revert them (git checkout -- apps/ios/Doma.xcodeproj/project.pbxproj) and set them in Device.xcconfig." >&2
  exit 1
fi
