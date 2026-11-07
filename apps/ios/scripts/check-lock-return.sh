#!/usr/bin/env bash
# Leaves an open sheet, waits past the lock, returns through Face ID, and checks the recording.
# Start with the app unlocked on the booted simulator, a sheet open, and <marker> typed into it.
# AGENT_DEVICE is the device command, for example the one device_open returns.
# Usage: AGENT_DEVICE=<command> check-lock-return.sh <bundle id> <marker> [seconds away]
set -euo pipefail

scripts_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bundle_id="${1:?bundle id required}"
marker="${2:?marker required}"
seconds_away="${3:-320}"
device="${AGENT_DEVICE:?set AGENT_DEVICE to the device command}"
recording="$(mktemp -d)/return.mp4"
trap 'rm -rf "$(dirname "$recording")"' EXIT

app_process() { pgrep -f 'Doma.app/Doma' | head -1; }

"$device" record start --scope device "$recording" >/dev/null
sleep 2
before="$(app_process)"
"$device" open com.apple.Preferences >/dev/null
sleep "$seconds_away"
"$device" open "$bundle_id" >/dev/null
sleep 3
# Past the lock timeout the app is asking for Face ID. Before it, this match does nothing.
"$device" settings faceid match >/dev/null
sleep 5
after="$(app_process)"
"$device" record stop >/dev/null

if [[ -z "$before" || "$before" != "$after" ]]; then
  echo "Inconclusive: the app restarted, so this was a cold launch, not a return." >&2
  exit 1
fi
swift "$scripts_dir/check-return-frames.swift" "$recording" "$marker" 2>/dev/null
