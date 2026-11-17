#!/usr/bin/env bash
# Builds the app and widgets for the simulator, installs them, waits for the Home widget to
# redraw, then saves a screenshot. Place the widget once first (README, "Home widget") and leave
# its Home Screen page showing: installing closes the app, so the page stays in view. Refuses a
# build aimed at production, as the sign-in script does.
# AGENT_DEVICE is the device command, for example the one device_open returns.
# Usage: AGENT_DEVICE=<command> widget-shot.sh <bundle id> <out.png>
set -euo pipefail

ios_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bundle_id="${1:?bundle id required}"
out="${2:?screenshot path required}"
device="${AGENT_DEVICE:?set AGENT_DEVICE to the device command}"
derived="$ios_dir/build/dd"
app="$derived/Build/Products/Debug-iphonesimulator/Doma.app"

xcodebuild build -quiet -project "$ios_dir/Doma.xcodeproj" -scheme Doma \
  -destination "${DOMA_IOS_DESTINATION:-$("$ios_dir/scripts/simulator-destination.sh")}" \
  -derivedDataPath "$derived"
"$ios_dir/scripts/check-simulator-target.sh" "$app/Info.plist"

since="$(date '+%Y-%m-%d %H:%M:%S')"
"$device" install "$bundle_id" "$app" >/dev/null

# Installing reloads the widgets; chronod logs each finished timeline request.
redrawn=""
for _ in $(seq 30); do
  if xcrun simctl spawn booted log show --start "$since" --style compact \
    --predicate 'eventMessage CONTAINS "Request ended for DomaHomeWidget"' 2>/dev/null | grep -q success; then
    redrawn=1
    break
  fi
  sleep 1
done
[[ -n "$redrawn" ]] || echo "No Home widget redraw logged in 30 s; the screenshot may be stale." >&2

# The renderer draws a moment after the timeline arrives.
sleep 2
"$device" screenshot "$out" --pixel-density 2 >/dev/null
echo "$out"
