#!/usr/bin/env bash
# Prints an xcodebuild destination for an available iPhone simulator on the newest iOS
# runtime installed, so scripts and CI do not hard-code a device that may not exist.
set -euo pipefail

xcrun simctl list -j devices available | python3 -c '
import json, re, sys
runtimes = json.load(sys.stdin)["devices"]
candidates = []
for runtime, devices in runtimes.items():
    match = re.fullmatch(r"com\.apple\.CoreSimulator\.SimRuntime\.iOS-(\d+)-(\d+)", runtime)
    if not match:
        continue
    version = tuple(int(part) for part in match.groups())
    candidates += [(version, d["name"], d["udid"]) for d in devices if d["name"].startswith("iPhone")]
if not candidates:
    sys.exit("No available iPhone simulator found.")
version, name, udid = max(candidates, key=lambda c: c[0])
print(f"platform=iOS Simulator,id={udid}")
'
