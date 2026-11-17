#!/usr/bin/env bash
# Builds the app for one simulator, refuses a build aimed at production, leaves a sign-in ticket,
# installs, and relaunches signed in with the app lock skipped. With an output path, it also saves
# a screenshot once the launch settles. Run `pnpm convex` first.
# AGENT_DEVICE is the device command, for example the one device_open returns.
# Usage: AGENT_DEVICE=<command> app-shot.sh <simulator udid> [out.png]
set -euo pipefail

ios_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
udid="${1:?simulator udid required}"
out="${2:-}"
device="${AGENT_DEVICE:?set AGENT_DEVICE to the device command}"
derived="$ios_dir/build/dd"
app="$derived/Build/Products/Debug-iphonesimulator/Doma.app"

xcodebuild build -quiet -project "$ios_dir/Doma.xcodeproj" -scheme Doma \
  -destination "platform=iOS Simulator,id=$udid" -derivedDataPath "$derived"
# Checks the target before minting the ticket.
"$ios_dir/scripts/simulator-sign-in.sh" "$app/Info.plist"

bundle_id="$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$app/Info.plist")"
"$device" install "$bundle_id" "$app" >/dev/null
"$device" open "$bundle_id" --relaunch --launch-args DOMA_SKIP_APP_LOCK=1 >/dev/null
echo "Launched $bundle_id"

if [[ -n "$out" ]]; then
  sleep 2
  "$device" screenshot "$out" >/dev/null
  echo "$out"
fi
