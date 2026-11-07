#!/usr/bin/env bash
# Warns when macOS is older than Xcode, which once stopped the simulator test service. Never fails.
set -uo pipefail

macos="$(sw_vers -productVersion)"
xcode="$(xcodebuild -version 2>/dev/null | sed -n 's/^Xcode //p')"
older="$(printf '%s\n%s\n' "$macos" "$xcode" | sort -V | head -1)"
if [[ -n "$xcode" && "$older" == "$macos" && "$macos" != "$xcode" ]]; then
  echo "Warning: macOS $macos is older than Xcode $xcode. If simulator taps or tests fail, update macOS." >&2
fi
