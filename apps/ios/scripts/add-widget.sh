#!/usr/bin/env bash
# Places one Doma widget on the simulator's current Home Screen page through the widget gallery.
# Leaves room for it first: the long-press lands at (200, 650), which must be empty Home Screen.
# The gallery lists the Home widget (small, medium), then the List widget (small, medium, large).
# AGENT_DEVICE is the device command, for example the one device_open returns.
# Usage: AGENT_DEVICE=<command> add-widget.sh <home-small|home-medium|list-small|list-medium|list-large>
set -euo pipefail

device="${AGENT_DEVICE:?set AGENT_DEVICE to the device command}"
case "${1:?widget required}" in
  home-small) page=1 ;;
  home-medium) page=2 ;;
  list-small) page=3 ;;
  list-medium) page=4 ;;
  list-large) page=5 ;;
  *) echo "Unknown widget: $1" >&2; exit 2 ;;
esac

# Prints the snapshot ref of the first element matching a pattern, or fails naming it.
ref() {
  local found
  found="$("$device" snapshot -i 2>/dev/null | grep -E "$1" | head -1 | awk '{print $1}')"
  [[ -n "$found" ]] || { echo "Not on screen: $1" >&2; exit 1; }
  echo "$found"
}

"$device" home >/dev/null
"$device" longpress 200 650 1500 >/dev/null
"$device" press "$(ref '\[button\] "Edit"')" --settle >/dev/null
"$device" press "$(ref '\[cell\] "Add Widget"')" --settle >/dev/null
"$device" press "$(ref '\[cell\] "Doma"')" --settle >/dev/null
for _ in $(seq 2 "$page"); do
  "$device" gesture fling left 195 450 >/dev/null
  sleep 1
done
ref "\"page $page of 5\"" >/dev/null
"$device" press "$(ref '\[button\] "Add Widget"')" --settle >/dev/null
sleep 1
"$device" press "$(ref '\[button\] "Done"')" >/dev/null
echo "Added $1"
