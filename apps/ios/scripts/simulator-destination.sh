#!/usr/bin/env bash
# Prints an xcodebuild destination for an available iPhone simulator on the newest iOS
# runtime installed, so scripts do not hard-code a device that may not exist. Fails when
# no runtime meets the app's deployment target.
set -euo pipefail

project="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/Doma.xcodeproj/project.pbxproj"
minimum="$(grep -m1 -oE 'IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+' "$project" | grep -oE '[0-9.]+$')"

xcrun simctl list -j devices available | MINIMUM="$minimum" python3 -c '
import json, os, re, sys
minimum = tuple(int(part) for part in (os.environ["MINIMUM"] + ".0").split(".")[:2])
runtimes = json.load(sys.stdin)["devices"]
candidates = []
for runtime, devices in runtimes.items():
    match = re.fullmatch(r"com\.apple\.CoreSimulator\.SimRuntime\.iOS-(\d+)-(\d+)", runtime)
    if not match:
        continue
    version = tuple(int(part) for part in match.groups())
    if version < minimum:
        continue
    candidates += [(version, d["name"], d["udid"]) for d in devices if d["name"].startswith("iPhone")]
if not candidates:
    sys.exit("No available iPhone simulator on iOS " + os.environ["MINIMUM"] + " or newer.")
version, name, udid = max(candidates, key=lambda c: c[0])
print(f"platform=iOS Simulator,id={udid}")
'
