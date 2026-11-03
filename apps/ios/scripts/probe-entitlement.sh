#!/usr/bin/env bash
# Signs a device build with a throwaway entitlements file and reports whether the issued
# provisioning profile and the signed app carry it. Use it to check what the free personal
# team can sign; Xcode's Signing & Capabilities screen is not reliable evidence.
#
#   probe-entitlement.sh app-group group.<bundle id>
#   probe-entitlement.sh keychain <bundle id>.shared
#
# Needs Config/Device.xcconfig and an Apple ID in Xcode. Registers the capability on the
# personal team's App ID; nothing in the repo changes.
set -euo pipefail

kind="${1:?usage: probe-entitlement.sh app-group|keychain <identifier>}"
identifier="${2:?usage: probe-entitlement.sh app-group|keychain <identifier>}"
case "$kind" in
  app-group) key="com.apple.security.application-groups"; value="$identifier" ;;
  keychain) key="keychain-access-groups"; value="\$(AppIdentifierPrefix)$identifier" ;;
  *) echo "Unknown kind: $kind" >&2; exit 2 ;;
esac

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cat > "$work/probe.entitlements" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>$key</key><array><string>$value</string></array></dict></plist>
PLIST

cd "$(dirname "${BASH_SOURCE[0]}")/.."
if ! xcodebuild build -project Doma.xcodeproj -scheme Doma -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates CODE_SIGN_ENTITLEMENTS="$work/probe.entitlements" \
  -derivedDataPath "$work/dd" -quiet > "$work/build.log" 2>&1; then
  echo "Signing failed for $key:" >&2
  grep -E "error:" "$work/build.log" | sort -u >&2
  exit 1
fi

app="$work/dd/Build/Products/Debug-iphoneos/Doma.app"
show() { python3 -c "import json,sys; print(json.load(sys.stdin).get('$key', 'absent'))"; }
echo "Signed app $key: $(codesign -d --entitlements - --xml "$app" 2>/dev/null | plutil -convert json -o - - | show)"
security cms -D -i "$app/embedded.mobileprovision" > "$work/profile.plist"
echo "Profile allows $key: $(plutil -extract Entitlements json -o - "$work/profile.plist" | show)"
